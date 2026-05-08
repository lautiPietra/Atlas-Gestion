// ============================================================
// stockController.js
// ============================================================
const StockController = {
    _movimientos: [],
    _productos: [],
    _tipoFilter: '',
    _search: '',
    _movDesde: '',
    _movHasta: '',

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        await this._load();
        this._draw(view);
    },

    async _load() {
        const [movs, prods] = await Promise.all([
            this._fetchMovimientos(),
            SupabaseClient.select('productos', { select: 'id,nombre,stock,codigo', order: 'nombre.asc', activo: 'eq.true' })
        ]);
        this._movimientos = movs || [];
        this._productos = prods || [];
    },

    async _fetchMovimientos() {
        const params = { select: '*', order: 'fecha.desc.nullslast,created_at.desc' };
        if (this._movDesde || this._movHasta) {
            const start = this._movDesde || this._movHasta;
            const end   = this._movHasta   || this._movDesde;
            params.or = Utils.buildDateOrFilter(start, end);
        } else {
            params.limit = 200;
        }
        return SupabaseClient.select('stock_movimientos', params);
    },

    _draw(view) {
        const stockBajo = this._productos.filter(p => (p.stock || 0) <= CONFIG.STOCK_MINIMO);

        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Stock</h2>
                    <p>Gestion de inventario y movimientos</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="StockController.openMovimiento()">
                        ${Utils.icon('plus')} Registrar movimiento
                    </button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab-btn active" id="tab-niveles" onclick="StockController.switchTab('niveles')">Niveles de stock</button>
                <button class="tab-btn" id="tab-movimientos" onclick="StockController.switchTab('movimientos')">Historial de movimientos</button>
            </div>

            <div id="tab-content-niveles">
                ${stockBajo.length ? `<div style="margin-bottom:14px;padding:12px 16px;background:#fef3c7;border:1.5px solid #fde68a;border-radius:var(--radius);font-size:.84rem;color:#92400e">
                    <strong>${stockBajo.length} producto(s) con stock bajo</strong>
                </div>` : ''}
                <div class="card" style="padding:0">
                    <div class="table-wrapper">${this._buildNivelesTable()}</div>
                </div>
            </div>

            <div id="tab-content-movimientos" style="display:none">
                <div class="stock-filters">
                    <div class="search-bar" style="flex:1;min-width:180px">
                        <span class="search-icon">${Utils.icon('search', 16)}</span>
                        <input type="text" placeholder="Buscar producto o codigo..." oninput="StockController.onSearch(this.value)"/>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <input type="date" class="dash-date-input" id="mov-desde" value="${this._movDesde}" title="Desde" onchange="StockController.onMovFechas()"/>
                        <span style="color:var(--gray-400);font-size:.85rem">—</span>
                        <input type="date" class="dash-date-input" id="mov-hasta" value="${this._movHasta}" title="Hasta" onchange="StockController.onMovFechas()"/>
                        ${this._movDesde || this._movHasta ? `<button class="btn btn-outline btn-sm" onclick="StockController.limpiarFechas()" title="Limpiar fechas">✕</button>` : ''}
                    </div>
                    <select class="categoria-filter" onchange="StockController.onTipoFilter(this.value)">
                        <option value="">Todos los tipos</option>
                        <option value="entrada">Entrada</option>
                        <option value="salida">Salida</option>
                        <option value="ajuste">Ajuste</option>
                    </select>
                </div>
                <div class="card" style="padding:0">
                    <div class="table-wrapper" id="mov-table-wrap">${this._buildMovTable()}</div>
                </div>
            </div>
        `;
    },

    switchTab(tab) {
        ['niveles', 'movimientos'].forEach(t => {
            document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
            const el = document.getElementById(`tab-content-${t}`);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
    },

    _buildNivelesTable() {
        if (!this._productos.length) return '<div class="empty-state"><span class="empty-icon">===</span><p>Sin productos</p></div>';
        const sorted = [...this._productos].sort((a, b) => (a.stock || 0) - (b.stock || 0));
        const body = sorted.map(p => {
            const stock = p.stock || 0;
            const pct = Math.min(100, (stock / Math.max(stock, 50)) * 100);
            const cls = stock <= CONFIG.STOCK_MINIMO ? 'low' : stock <= CONFIG.STOCK_MINIMO * 3 ? 'mid' : 'high';
            return `<tr>
                <td><span class="producto-code">${Utils.escape(p.codigo || '-')}</span></td>
                <td><strong>${Utils.escape(p.nombre)}</strong></td>
                <td>
                    <div class="stock-cell">
                        <span class="stock-num ${stock <= CONFIG.STOCK_MINIMO ? 'stock-low' : 'stock-ok'}">${Utils.number(stock)}</span>
                        <div class="stock-bar"><div class="stock-bar-fill ${cls}" style="width:${pct}%"></div></div>
                    </div>
                </td>
                <td>
                    ${stock <= CONFIG.STOCK_MINIMO
                        ? `<span class="badge badge-danger">Stock bajo</span>`
                        : `<span class="badge badge-success">Normal</span>`}
                </td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="StockController.openMovimiento(${p.id})">
                        ${Utils.icon('plus', 13)} Movimiento
                    </button>
                </td>
            </tr>`;
        }).join('');

        return `<table class="table">
            <thead><tr><th>Codigo</th><th>Producto</th><th style="min-width:200px">Stock actual</th><th>Estado</th><th></th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    _filteredMovs() {
        let list = this._movimientos;
        if (this._search) {
            const q = Utils.normalizeText(this._search);
            list = list.filter(m =>
                Utils.normalizeText(m.producto_nombre).includes(q) ||
                Utils.normalizeText(m.motivo).includes(q)
            );
        }
        if (this._tipoFilter) list = list.filter(m => m.tipo === this._tipoFilter);
        return list;
    },

    _buildMovTable() {
        const rows = this._filteredMovs();
        if (!rows.length) return '<div class="empty-state"><span class="empty-icon">===</span><p>Sin movimientos registrados</p></div>';
        const body = rows.map(m => `<tr>
            <td>${m.fecha ? Utils.date(m.fecha) : Utils.datetime(m.created_at)}</td>
            <td><strong>${Utils.escape(m.producto_nombre || '-')}</strong></td>
            <td><span class="tipo-badge tipo-${m.tipo}">${m.tipo}</span></td>
            <td style="font-weight:600;color:${m.cantidad > 0 ? '#16a34a' : m.cantidad < 0 ? '#dc2626' : '#92400e'}">
                ${m.cantidad > 0 ? '+' : ''}${Utils.number(m.cantidad || 0)}
            </td>
            <td>${Utils.escape(m.motivo || '-')}</td>
        </tr>`).join('');

        return `<table class="table">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    onSearch: Utils.debounce(function(val) {
        StockController._search = val;
        const wrap = document.getElementById('mov-table-wrap');
        if (wrap) wrap.innerHTML = StockController._buildMovTable();
    }, 300),

    onTipoFilter(val) {
        this._tipoFilter = val;
        const wrap = document.getElementById('mov-table-wrap');
        if (wrap) wrap.innerHTML = this._buildMovTable();
    },

    async onMovFechas() {
        this._movDesde = document.getElementById('mov-desde')?.value || '';
        this._movHasta = document.getElementById('mov-hasta')?.value || '';
        const wrap = document.getElementById('mov-table-wrap');
        if (wrap) wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        this._movimientos = await this._fetchMovimientos();
        if (wrap) wrap.innerHTML = this._buildMovTable();
        const limpiar = document.getElementById('mov-limpiar-btn');
        if (this._movDesde || this._movHasta) {
            if (!limpiar) {
                const btn = document.createElement('button');
                btn.id = 'mov-limpiar-btn';
                btn.className = 'btn btn-outline btn-sm';
                btn.title = 'Limpiar fechas';
                btn.textContent = '✕';
                btn.onclick = () => StockController.limpiarFechas();
                document.querySelector('#tab-content-movimientos .stock-filters div')?.appendChild(btn);
            }
        } else {
            limpiar?.remove();
        }
    },

    async limpiarFechas() {
        this._movDesde = '';
        this._movHasta = '';
        const desde = document.getElementById('mov-desde');
        const hasta  = document.getElementById('mov-hasta');
        if (desde) desde.value = '';
        if (hasta)  hasta.value = '';
        const wrap = document.getElementById('mov-table-wrap');
        if (wrap) wrap.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        this._movimientos = await this._fetchMovimientos();
        if (wrap) wrap.innerHTML = this._buildMovTable();
    },

    async openMovimiento(productoId = null) {
        const prodOpts = this._productos.map(p =>
            `<option value="${p.id}" data-nombre="${Utils.escape(p.nombre)}">${Utils.escape(p.nombre)} (Stock: ${p.stock})</option>`
        ).join('');

        Modal.open({
            title: 'Registrar movimiento de stock',
            size: 'md',
            body: `
                <div class="form-group">
                    <label class="form-label required">Producto</label>
                    <select class="form-select" id="mov-producto">${prodOpts}</select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">Tipo</label>
                        <select class="form-select" id="mov-tipo">
                            <option value="entrada">Entrada (aumenta stock)</option>
                            <option value="salida">Salida (disminuye stock)</option>
                            <option value="ajuste">Ajuste (define stock final)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Cantidad</label>
                        <input type="number" class="form-input" id="mov-cantidad" min="0" value="1"/>
                        <span class="form-hint">En ajuste, este valor sera el stock final.</span>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Motivo / Observacion</label>
                    <input class="form-input" id="mov-motivo" placeholder="Ej: Compra a proveedor, venta, correccion..."/>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="StockController.saveMovimiento()">Registrar</button>
            `
        });

        if (productoId) {
            setTimeout(() => {
                const sel = document.getElementById('mov-producto');
                if (sel) sel.value = productoId;
            }, 50);
        }
    },

    async saveMovimiento() {
        const sel = document.getElementById('mov-producto');
        const prodId = parseInt(sel.value);
        const tipo = document.getElementById('mov-tipo').value;
        const cantidadIngresada = parseInt(document.getElementById('mov-cantidad').value);
        const motivoIngresado = document.getElementById('mov-motivo').value.trim();
        const prodNombre = sel.options[sel.selectedIndex]?.dataset.nombre || '';

        if (!prodId || Number.isNaN(cantidadIngresada) || cantidadIngresada < 0) {
            Toast.warning('Completa los campos obligatorios');
            return;
        }

        try {
            const prod = this._productos.find(p => p.id === prodId);
            if (!prod) throw new Error('Producto no encontrado');

            let nuevoStock = prod.stock || 0;
            let cantidadMovimiento = cantidadIngresada;
            const motivo = motivoIngresado || (tipo === 'ajuste' ? 'Ajuste manual' : 'Movimiento manual');

            if (tipo === 'entrada') {
                if (cantidadIngresada < 1) {
                    Toast.warning('La entrada debe ser mayor a 0');
                    return;
                }
                nuevoStock += cantidadIngresada;
            } else if (tipo === 'salida') {
                if (cantidadIngresada < 1) {
                    Toast.warning('La salida debe ser mayor a 0');
                    return;
                }
                if (cantidadIngresada > nuevoStock) {
                    Toast.warning('Stock insuficiente para la salida');
                    return;
                }
                nuevoStock -= cantidadIngresada;
                cantidadMovimiento = -cantidadIngresada;
            } else {
                cantidadMovimiento = cantidadIngresada - (prod.stock || 0);
                nuevoStock = cantidadIngresada;
                if (cantidadMovimiento === 0) {
                    Toast.info('El stock ya tiene ese valor');
                    return;
                }
            }

            await Promise.all([
                SupabaseClient.update('productos', prodId, { stock: nuevoStock }),
                SupabaseClient.insert('stock_movimientos', {
                    producto_id: prodId,
                    producto_nombre: prodNombre,
                    tipo,
                    cantidad: cantidadMovimiento,
                    motivo,
                    fecha: new Date().toLocaleDateString('sv')
                })
            ]);

            Toast.success(`Movimiento registrado. Stock nuevo: ${nuevoStock}`);
            Modal.close();
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
        }
    }
};

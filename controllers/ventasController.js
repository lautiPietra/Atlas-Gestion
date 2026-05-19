// ============================================================
// ventasController.js
// ============================================================
const VentasController = {
    _ventas: [],
    _clientes: [],
    _productos: [],
    _carrito: [],
    _filters: { desde: '', hasta: '', buscar: '', estado: '' },

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        await this._load();
        this._draw(view);
    },

    async _load() {
        const [ventas, clientes, productos] = await Promise.all([
            SupabaseClient.select('ventas', { select: '*', order: 'fecha.desc.nullslast,created_at.desc', limit: 1000 }),
            SupabaseClient.select('clientes', { select: 'id,nombre,notas', order: 'nombre.asc' }),
            SupabaseClient.select('productos', { select: 'id,nombre,precio,stock,codigo', order: 'nombre.asc', activo: 'eq.true' })
        ]);
        this._ventas = ventas || [];
        this._clientes = (clientes || []).filter(c => !Utils.hasInactiveMarker(c.notas));
        this._productos = productos || [];
    },

    _applyFilters() {
        let result = this._ventas;
        const { desde, hasta, buscar, estado } = this._filters;
        if (desde)   result = result.filter(v => (Utils.effectiveDate(v) || '') >= desde);
        if (hasta)   result = result.filter(v => (Utils.effectiveDate(v) || '') <= hasta);
        if (estado)  result = result.filter(v => v.estado === estado);
        if (buscar) {
            const q = Utils.normalizeText(buscar);
            result = result.filter(v =>
                Utils.normalizeText(v.cliente_nombre || '').includes(q) ||
                String(v.id).includes(q)
            );
        }
        return result;
    },

    _draw(view) {
        const f = this._filters;
        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Ventas</h2>
                    <p id="ventas-summary">...</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="VentasController.openNuevaVenta()">
                        ${Utils.icon('plus')} Nueva venta
                    </button>
                </div>
            </div>

            <div class="list-filters">
                <input type="text" class="form-input list-filter-search" id="v-buscar"
                       placeholder="Buscar por cliente o #ID..." value="${Utils.escape(f.buscar)}"/>
                <div class="list-filter-dates">
                    <input type="date" class="dash-date-input" id="v-desde" value="${f.desde}" title="Fecha desde"/>
                    <span class="list-filter-sep">—</span>
                    <input type="date" class="dash-date-input" id="v-hasta" value="${f.hasta}" title="Fecha hasta"/>
                </div>
                <select class="categoria-filter" id="v-estado">
                    <option value="">Todos los estados</option>
                    <option value="completada"  ${f.estado==='completada' ?'selected':''}>Completada</option>
                    <option value="cancelada"   ${f.estado==='cancelada'  ?'selected':''}>Cancelada</option>
                </select>
                <button class="btn btn-outline btn-sm" id="v-limpiar">Limpiar</button>
            </div>

            <div class="card" style="padding:0">
                <div id="ventas-table-wrap"></div>
            </div>
        `;
        this._wireFilters();
        this._redrawTable();
    },

    _wireFilters() {
        const bind = (id, key, evt = 'input') => {
            document.getElementById(id)?.addEventListener(evt, e => {
                this._filters[key] = e.target.value;
                this._redrawTable();
            });
        };
        bind('v-buscar', 'buscar');
        bind('v-desde',  'desde',  'change');
        bind('v-hasta',  'hasta',  'change');
        bind('v-estado', 'estado', 'change');
        document.getElementById('v-limpiar')?.addEventListener('click', () => {
            this._filters = { desde: '', hasta: '', buscar: '', estado: '' };
            this._draw(document.getElementById('app-view'));
        });
    },

    _redrawTable() {
        const filtered = this._applyFilters();
        const completadas = filtered.filter(v => v.estado === 'completada');
        const total = completadas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const summary = document.getElementById('ventas-summary');
        if (summary) {
            const hasFilters = Object.values(this._filters).some(v => v !== '');
            const base = hasFilters ? filtered.length : this._ventas.length;
            summary.textContent = `${base} venta(s) — ${Utils.currency(total)} neto (${completadas.length} completada(s))`;
        }
        const wrap = document.getElementById('ventas-table-wrap');
        if (wrap) wrap.innerHTML = this._buildTable(filtered);
    },

    _buildTable(ventas) {
        if (!ventas.length) return '<div class="empty-state"><span class="empty-icon">◎</span><p>Sin resultados</p></div>';
        const body = ventas.map(v => `<tr>
            <td style="font-family:var(--font-mono);font-size:.78rem">#${v.id}</td>
            <td>${Utils.date(v.fecha || v.created_at)}</td>
            <td><strong>${Utils.escape(v.cliente_nombre || 'Consumidor final')}</strong></td>
            <td>${v.items_count || 0} item(s)</td>
            <td class="precio-cell">${Utils.currency(v.total)}</td>
            <td>${Utils.statusBadge(v.estado)}</td>
            <td><div class="actions">
                <button class="btn btn-outline btn-sm btn-icon" title="Ver detalle" onclick="VentasController.verDetalle(${v.id})">${Utils.icon('eye', 14)}</button>
                ${v.estado === 'cancelada'
                    ? '<span class="badge badge-danger">Cancelada</span>'
                    : `<button class="btn btn-danger btn-sm btn-icon" title="Cancelar" onclick="VentasController.cancelarVenta(${v.id})">${Utils.icon('trash', 14)}</button>`}
            </div></td>
        </tr>`).join('');

        return `<table class="table">
            <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    openNuevaVenta() {
        this._carrito = [];
        const clienteOpts = this._clientes.map(c =>
            `<option value="${c.id}" data-nombre="${Utils.escape(c.nombre)}">${Utils.escape(c.nombre)}</option>`
        ).join('');

        Modal.open({
            title: 'Nueva venta',
            size: 'lg',
            body: `
                <div class="venta-header">
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Cliente</label>
                        <select class="form-select" id="venta-cliente">
                            <option value="">Consumidor final</option>
                            ${clienteOpts}
                        </select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Notas</label>
                        <input class="form-input" id="venta-notas" placeholder="Observaciones opcionales..."/>
                    </div>
                </div>

                <div class="cart-section">
                    <div class="cart-section-title">Agregar productos</div>
                    <div class="add-item-row">
                        <div class="form-group" style="flex:2;min-width:0">
                            <label class="form-label">Producto</label>
                            <div class="prod-selector" id="venta-prod-wrap">
                                <input type="text" class="form-input" id="venta-prod-search"
                                       placeholder="Buscar por nombre o codigo..."
                                       oninput="VentasController._filtrarDropdown(this.value)"
                                       onfocus="VentasController._abrirDropdown()"
                                       autocomplete="off"/>
                                <div class="prod-dropdown" id="venta-prod-dropdown"></div>
                                <input type="hidden" id="venta-prod-id" data-stock="" data-nombre="" data-codigo=""/>
                            </div>
                        </div>
                        <div class="form-group" style="max-width:100px">
                            <label class="form-label">Cantidad</label>
                            <input type="number" class="form-input" id="venta-cant" value="1" min="1"/>
                        </div>
                        <div class="form-group" style="max-width:130px">
                            <label class="form-label">Precio unit.</label>
                            <input type="number" class="form-input" id="venta-precio" step="0.01" min="0"/>
                        </div>
                        <button class="btn btn-outline" style="align-self:flex-end" onclick="VentasController.agregarItem()">
                            ${Utils.icon('plus', 14)} Agregar
                        </button>
                    </div>
                    <div id="carrito-wrap"></div>
                    <div class="total-bar">
                        <span class="total-label">Total:</span>
                        <span class="total-value" id="venta-total">${Utils.currency(0)}</span>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="VentasController.confirmarVenta()">Confirmar venta</button>
            `
        });

        setTimeout(() => {
            VentasController._renderDropdown('');
            document.addEventListener('mousedown', VentasController._cerrarDropdownHandler);
        }, 80);
    },

    _cerrarDropdownHandler(e) {
        const wrap = document.getElementById('venta-prod-wrap');
        if (wrap && !wrap.contains(e.target)) {
            document.getElementById('venta-prod-dropdown')?.classList.remove('open');
            document.getElementById('venta-prod-search')?.classList.remove('dropdown-open');
        }
    },

    _abrirDropdown() {
        const q = document.getElementById('venta-prod-search')?.value || '';
        this._renderDropdown(q);
    },

    _filtrarDropdown(q) {
        this._renderDropdown(q);
    },

    _renderDropdown(q) {
        const dropdown = document.getElementById('venta-prod-dropdown');
        const searchEl = document.getElementById('venta-prod-search');
        if (!dropdown) return;

        const query = Utils.normalizeText(q);
        const filtered = query
            ? this._productos.filter(p =>
                Utils.normalizeText(p.nombre).includes(query) ||
                Utils.normalizeText(p.codigo).includes(query))
            : this._productos;

        if (!filtered.length) {
            dropdown.innerHTML = '<div class="prod-no-results">Sin resultados</div>';
        } else {
            dropdown.innerHTML = filtered.slice(0, 40).map(p => {
                const stockCls = (p.stock || 0) <= CONFIG.STOCK_MINIMO ? 'prod-item-stock-low' : '';
                return `<div class="prod-dropdown-item"
                             onclick="VentasController._seleccionarProducto(${p.id})">
                    <span>
                        <span class="prod-item-name">${Utils.escape(p.nombre)}</span>
                        ${p.codigo ? `<span class="prod-item-code"> [${Utils.escape(p.codigo)}]</span>` : ''}
                    </span>
                    <span class="prod-item-meta">
                        ${Utils.currency(p.precio)}
                        &nbsp;|&nbsp;
                        <span class="${stockCls}">Stock: ${p.stock || 0}</span>
                    </span>
                </div>`;
            }).join('');
        }

        dropdown.classList.add('open');
        searchEl?.classList.add('dropdown-open');
    },

    _seleccionarProducto(id) {
        const prod = this._productos.find(p => p.id === id);
        if (!prod) return;
        const hidden = document.getElementById('venta-prod-id');
        if (hidden) {
            hidden.value = id;
            hidden.dataset.stock = prod.stock || 0;
            hidden.dataset.nombre = prod.nombre;
            hidden.dataset.codigo = prod.codigo || '';
        }
        const searchEl = document.getElementById('venta-prod-search');
        if (searchEl) searchEl.value = prod.nombre;

        const precioEl = document.getElementById('venta-precio');
        if (precioEl) precioEl.value = prod.precio;

        document.getElementById('venta-prod-dropdown')?.classList.remove('open');
        searchEl?.classList.remove('dropdown-open');
        document.getElementById('venta-cant')?.focus();
    },

    _cantidadReservada(productoId, exceptIndex = -1) {
        return this._carrito.reduce((sum, item, index) => {
            if (index === exceptIndex || item.producto_id !== productoId) return sum;
            return sum + item.cantidad;
        }, 0);
    },

    agregarItem() {
        const hidden = document.getElementById('venta-prod-id');
        const prodId = parseInt(hidden?.value);
        const stock = parseInt(hidden?.dataset.stock || 0, 10);
        const nombre = hidden?.dataset.nombre || '';
        const codigo = hidden?.dataset.codigo || '';
        const cant = parseInt(document.getElementById('venta-cant').value, 10) || 1;
        const precio = parseFloat(document.getElementById('venta-precio').value) || 0;

        if (!prodId) { Toast.warning('Selecciona un producto'); return; }
        if (cant < 1) { Toast.warning('La cantidad debe ser mayor a 0'); return; }
        if (precio < 0) { Toast.warning('El precio no puede ser negativo'); return; }
        if (precio === 0 && !confirm('El precio es $0. ¿Confirmas que querés agregar este ítem gratis?')) return;

        const yaEnCarrito = this._cantidadReservada(prodId);
        if (yaEnCarrito + cant > stock) {
            Toast.warning(`Stock insuficiente. Disponible: ${Math.max(stock - yaEnCarrito, 0)}`);
            return;
        }

        const existing = this._carrito.find(i => i.producto_id === prodId && i.precio_unitario === precio);
        if (existing) {
            existing.cantidad += cant;
            existing.subtotal = existing.cantidad * existing.precio_unitario;
        } else {
            this._carrito.push({
                producto_id: prodId,
                producto_nombre: nombre,
                producto_codigo: codigo,
                cantidad: cant,
                precio_unitario: precio,
                subtotal: cant * precio
            });
        }
        this._renderCarrito();
    },

    _renderCarrito() {
        const wrap = document.getElementById('carrito-wrap');
        if (!wrap) return;
        if (!this._carrito.length) {
            wrap.innerHTML = '<p style="font-size:.82rem;color:var(--gray-400);padding:8px 0">Sin items agregados aun.</p>';
            const tel = document.getElementById('venta-total');
            if (tel) tel.textContent = Utils.currency(0);
            return;
        }
        const rows = this._carrito.map((item, i) => `<tr>
            <td>${Utils.escape(item.producto_nombre)}${item.producto_codigo ? `<br><span class="producto-code">${Utils.escape(item.producto_codigo)}</span>` : ''}</td>
            <td><input type="number" value="${item.cantidad}" min="1" style="width:60px;padding:3px 6px;border:1.5px solid var(--gray-300);border-radius:2px;font-size:.83rem"
                       onchange="VentasController.updateCantidad(${i}, this.value)"/></td>
            <td>${Utils.currency(item.precio_unitario)}</td>
            <td style="font-weight:600">${Utils.currency(item.subtotal)}</td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="VentasController.quitarItem(${i})">${Utils.icon('trash', 13)}</button></td>
        </tr>`).join('');

        const total = this._carrito.reduce((s, i) => s + i.subtotal, 0);
        wrap.innerHTML = `<table class="cart-table">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
        const tel = document.getElementById('venta-total');
        if (tel) tel.textContent = Utils.currency(total);
    },

    updateCantidad(i, val) {
        const cant = parseInt(val, 10);
        if (cant < 1) return;
        const item = this._carrito[i];
        if (!item) return;
        const prod = this._productos.find(p => p.id === item.producto_id);
        const reservado = this._cantidadReservada(item.producto_id, i);
        const stockDisponible = prod?.stock || 0;
        if (prod && cant + reservado > stockDisponible) {
            Toast.warning(`Stock maximo disponible: ${Math.max(stockDisponible - reservado, 0)}`);
            this._renderCarrito();
            return;
        }
        item.cantidad = cant;
        item.subtotal = cant * item.precio_unitario;
        this._renderCarrito();
    },

    quitarItem(i) {
        this._carrito.splice(i, 1);
        this._renderCarrito();
    },

    async confirmarVenta() {
        if (!this._carrito.length) { Toast.warning('Agrega al menos un producto'); return; }

        const btnConfirmar = document.querySelector('.modal-footer .btn-primary');
        if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = 'Procesando...'; }

        const sel = document.getElementById('venta-cliente');
        const clienteId = parseInt(sel?.value, 10) || null;
        const clienteNombre = clienteId ? (sel?.options[sel.selectedIndex]?.dataset.nombre || '') : 'Consumidor final';
        const notas = document.getElementById('venta-notas')?.value.trim() || '';
        const total = this._carrito.reduce((s, i) => s + i.subtotal, 0);

        try {
            const productosActuales = await Promise.all(
                this._carrito.map(item => SupabaseClient.selectOne('productos', item.producto_id))
            );

            for (let idx = 0; idx < this._carrito.length; idx++) {
                const item = this._carrito[idx];
                const prod = productosActuales[idx];
                if (!prod) throw new Error(`El producto "${item.producto_nombre}" ya no existe`);
                if ((prod.stock || 0) < item.cantidad) {
                    throw new Error(`Stock insuficiente para "${item.producto_nombre}". Disponible: ${prod.stock || 0}`);
                }
            }

            const ventaArr = await SupabaseClient.insert('ventas', {
                cliente_id: clienteId,
                cliente_nombre: clienteNombre,
                total,
                items_count: this._carrito.length,
                estado: 'completada',
                notas,
                fecha: WorkDate.get(),
                created_by: Auth.getUser()?.username || 'sistema'
            });
            const venta = Array.isArray(ventaArr) ? ventaArr[0] : ventaArr;

            await Promise.all(this._carrito.map(async (item, idx) => {
                const prod = productosActuales[idx];
                await SupabaseClient.insert('venta_items', {
                    venta_id: venta.id,
                    producto_id: item.producto_id,
                    producto_nombre: item.producto_nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal
                });
                const updated = await SupabaseClient.updateIf('productos', item.producto_id,
                    { stock: (prod.stock || 0) - item.cantidad },
                    { stock: `gte.${item.cantidad}` }
                );
                if (!updated || !updated.length)
                    throw new Error(`Stock de "${item.producto_nombre}" cambió mientras se procesaba. Reintentá la venta.`);
                await SupabaseClient.insert('stock_movimientos', {
                    producto_id: item.producto_id,
                    producto_nombre: item.producto_nombre,
                    tipo: 'salida',
                    cantidad: -item.cantidad,
                    motivo: `Venta #${venta.id}`,
                    fecha: WorkDate.get(),
                    created_by: Auth.getUser()?.username || 'sistema'
                });
            }));

            Toast.success(`Venta registrada - Total: ${Utils.currency(total)}`);
            Modal.close();
            this._carrito = [];
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
            const btn = document.querySelector('.modal-footer .btn-primary');
            if (btn) { btn.disabled = false; btn.textContent = 'Confirmar venta'; }
        }
    },

    async verDetalle(ventaId) {
        try {
            const [venta, items] = await Promise.all([
                SupabaseClient.selectOne('ventas', ventaId),
                SupabaseClient.select('venta_items', { select: '*', venta_id: `eq.${ventaId}` })
            ]);
            const rows = (items || []).map(i => `<tr>
                <td>${Utils.escape(i.producto_nombre)}</td>
                <td>${i.cantidad}</td>
                <td>${Utils.currency(i.precio_unitario)}</td>
                <td style="font-weight:600">${Utils.currency(i.subtotal)}</td>
            </tr>`).join('');

            Modal.open({
                title: `Venta #${ventaId}`,
                size: 'md',
                body: `
                    <div class="venta-detail-header">
                        <div class="detail-field">
                            <span class="detail-field-label">Fecha</span>
                            <span class="detail-field-value">${Utils.date(venta?.fecha || venta?.created_at)}</span>
                        </div>
                        <div class="detail-field">
                            <span class="detail-field-label">Cliente</span>
                            <span class="detail-field-value">${Utils.escape(venta?.cliente_nombre || 'Consumidor final')}</span>
                        </div>
                        <div class="detail-field">
                            <span class="detail-field-label">Estado</span>
                            <span class="detail-field-value">${Utils.statusBadge(venta?.estado)}</span>
                        </div>
                    </div>
                    ${venta?.notas ? `<p style="font-size:.83rem;color:var(--gray-500);margin-bottom:14px">Notas: ${Utils.escape(venta.notas)}</p>` : ''}
                    <div class="table-wrapper">
                        <table class="table">
                            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">Sin items</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div class="total-bar" style="margin-top:10px">
                        <span class="total-label">Total:</span>
                        <span class="total-value">${Utils.currency(venta?.total)}</span>
                    </div>
                `
            });
        } catch (err) { Toast.error(err.message); }
    },

    cancelarVenta(id) {
        Modal.confirm({
            title: 'Cancelar venta',
            message: `Cancelar la venta #${id}? Se revertira el stock descontado.`,
            danger: true,
            onConfirm: async () => {
                try {
                    const venta = await SupabaseClient.selectOne('ventas', id);
                    if (!venta) throw new Error('Venta no encontrada');
                    if (venta.estado === 'cancelada') {
                        Toast.info('La venta ya esta cancelada');
                        return;
                    }

                    const items = await SupabaseClient.select('venta_items', { select: '*', venta_id: `eq.${id}` });
                    await Promise.all((items || []).map(async item => {
                        const prod = await SupabaseClient.selectOne('productos', item.producto_id);
                        if (!prod) return;
                        await SupabaseClient.update('productos', item.producto_id, {
                            stock: (prod.stock || 0) + item.cantidad
                        });
                        await SupabaseClient.insert('stock_movimientos', {
                            producto_id: item.producto_id,
                            producto_nombre: item.producto_nombre,
                            tipo: 'entrada',
                            cantidad: item.cantidad,
                            motivo: `Cancelacion venta #${id}`,
                            fecha: new Date().toLocaleDateString('sv')
                        });
                    }));
                    await SupabaseClient.update('ventas', id, { estado: 'cancelada' });
                    Toast.success('Venta cancelada y stock revertido');
                    await this._load();
                    this._draw(document.getElementById('app-view'));
                } catch (err) { Toast.error(err.message); }
            }
        });
    }
};

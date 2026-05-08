// ============================================================
// comprasController.js
// ============================================================
const ComprasController = {
    _compras: [],
    _proveedores: [],
    _productos: [],
    _carrito: [],
    _filters: { desde: '', hasta: '', buscar: '', estado: '' },

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        await this._load();
        this._draw(view);
    },

    async _load() {
        const [compras, proveedores, productos] = await Promise.all([
            SupabaseClient.select('compras', { select: '*', order: 'fecha.desc.nullslast,created_at.desc', limit: 1000 }),
            SupabaseClient.select('proveedores', { select: 'id,nombre,notas', order: 'nombre.asc' }),
            SupabaseClient.select('productos', { select: 'id,nombre,precio_compra,stock,codigo', order: 'nombre.asc', activo: 'eq.true' })
        ]);
        this._compras = compras || [];
        this._proveedores = (proveedores || []).filter(p => !Utils.hasInactiveMarker(p.notas));
        this._productos = productos || [];
    },

    _applyFilters() {
        let result = this._compras;
        const { desde, hasta, buscar, estado } = this._filters;
        if (desde)   result = result.filter(c => (Utils.effectiveDate(c) || '') >= desde);
        if (hasta)   result = result.filter(c => (Utils.effectiveDate(c) || '') <= hasta);
        if (estado)  result = result.filter(c => c.estado === estado);
        if (buscar) {
            const q = Utils.normalizeText(buscar);
            result = result.filter(c =>
                Utils.normalizeText(c.proveedor_nombre || '').includes(q) ||
                String(c.id).includes(q)
            );
        }
        return result;
    },

    _draw(view) {
        const f = this._filters;
        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Compras</h2>
                    <p id="compras-summary">...</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="ComprasController.openNuevaCompra()">
                        ${Utils.icon('plus')} Nueva compra
                    </button>
                </div>
            </div>

            <div class="list-filters">
                <input type="text" class="form-input list-filter-search" id="c-buscar"
                       placeholder="Buscar por proveedor o #ID..." value="${Utils.escape(f.buscar)}"/>
                <div class="list-filter-dates">
                    <input type="date" class="dash-date-input" id="c-desde" value="${f.desde}" title="Fecha desde"/>
                    <span class="list-filter-sep">—</span>
                    <input type="date" class="dash-date-input" id="c-hasta" value="${f.hasta}" title="Fecha hasta"/>
                </div>
                <select class="categoria-filter" id="c-estado">
                    <option value="">Todos los estados</option>
                    <option value="recibida"  ${f.estado==='recibida'  ?'selected':''}>Recibida</option>
                    <option value="pendiente" ${f.estado==='pendiente' ?'selected':''}>Pendiente</option>
                    <option value="cancelada" ${f.estado==='cancelada' ?'selected':''}>Cancelada</option>
                </select>
                <button class="btn btn-outline btn-sm" id="c-limpiar">Limpiar</button>
            </div>

            <div class="card" style="padding:0">
                <div id="compras-table-wrap"></div>
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
        bind('c-buscar', 'buscar');
        bind('c-desde',  'desde',  'change');
        bind('c-hasta',  'hasta',  'change');
        bind('c-estado', 'estado', 'change');
        document.getElementById('c-limpiar')?.addEventListener('click', () => {
            this._filters = { desde: '', hasta: '', buscar: '', estado: '' };
            this._draw(document.getElementById('app-view'));
        });
    },

    _redrawTable() {
        const filtered = this._applyFilters();
        const recibidas = filtered.filter(c => c.estado === 'recibida');
        const pendientes = filtered.filter(c => c.estado === 'pendiente');
        const total = recibidas.reduce((s, c) => s + parseFloat(c.total || 0), 0);
        const summary = document.getElementById('compras-summary');
        if (summary) {
            const hasFilters = Object.values(this._filters).some(v => v !== '');
            const base = hasFilters ? filtered.length : this._compras.length;
            const pendStr = pendientes.length ? `, ${pendientes.length} pendiente(s)` : '';
            summary.textContent = `${base} orden(es) — ${Utils.currency(total)} neto (${recibidas.length} recibida(s)${pendStr})`;
        }
        const wrap = document.getElementById('compras-table-wrap');
        if (wrap) wrap.innerHTML = this._buildTable(filtered);
    },

    _buildTable(compras) {
        if (!compras.length) return '<div class="empty-state"><span class="empty-icon">◎</span><p>Sin resultados</p></div>';
        const body = compras.map(c => `<tr>
            <td style="font-family:var(--font-mono);font-size:.78rem">#${c.id}</td>
            <td>${Utils.date(c.fecha || c.created_at)}</td>
            <td><strong>${Utils.escape(c.proveedor_nombre || 'Sin proveedor')}</strong></td>
            <td>${c.items_count || 0} item(s)</td>
            <td class="precio-cell">${Utils.currency(c.total)}</td>
            <td>${Utils.statusBadge(c.estado)}</td>
            <td><div class="actions">
                <button class="btn btn-outline btn-sm btn-icon" title="Ver detalle" onclick="ComprasController.verDetalle(${c.id})">${Utils.icon('eye', 14)}</button>
                ${c.estado === 'cancelada'
                    ? '<span class="badge badge-danger">Cancelada</span>'
                    : c.estado === 'pendiente'
                        ? `<button class="btn btn-primary btn-sm" onclick="ComprasController.recibirCompra(${c.id})">Recibir</button>
                           <button class="btn btn-danger btn-sm btn-icon" title="Cancelar" onclick="ComprasController.cancelarCompra(${c.id}, true)">${Utils.icon('trash', 14)}</button>`
                        : `<button class="btn btn-danger btn-sm btn-icon" title="Cancelar" onclick="ComprasController.cancelarCompra(${c.id}, false)">${Utils.icon('trash', 14)}</button>`}
            </div></td>
        </tr>`).join('');

        return `<table class="table">
            <thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    openNuevaCompra() {
        this._carrito = [];
        const provOpts = this._proveedores.map(p =>
            `<option value="${p.id}" data-nombre="${Utils.escape(p.nombre)}">${Utils.escape(p.nombre)}</option>`
        ).join('');

        Modal.open({
            title: 'Nueva compra',
            size: 'lg',
            body: `
                <div class="venta-header">
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Proveedor</label>
                        <select class="form-select" id="compra-proveedor">
                            <option value="">Sin proveedor</option>
                            ${provOpts}
                        </select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Estado</label>
                        <select class="form-select" id="compra-estado">
                            <option value="recibida">Recibida (mercadería ya llegó)</option>
                            <option value="pendiente">Pendiente (mercadería en camino)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label class="form-label">Notas</label>
                        <input class="form-input" id="compra-notas" placeholder="Observaciones opcionales..."/>
                    </div>
                </div>

                <div class="cart-section">
                    <div class="cart-section-title">Agregar productos</div>
                    <div class="add-item-row">
                        <div class="form-group" style="flex:2;min-width:0">
                            <label class="form-label">Producto</label>
                            <div class="prod-selector" id="compra-prod-wrap">
                                <input type="text" class="form-input" id="compra-prod-search"
                                       placeholder="Buscar por nombre o codigo..."
                                       oninput="ComprasController._filtrarDropdown(this.value)"
                                       onfocus="ComprasController._abrirDropdown()"
                                       autocomplete="off"/>
                                <div class="prod-dropdown" id="compra-prod-dropdown"></div>
                                <input type="hidden" id="compra-prod-id" data-nombre="" data-codigo=""/>
                            </div>
                        </div>
                        <div class="form-group" style="max-width:100px">
                            <label class="form-label">Cantidad</label>
                            <input type="number" class="form-input" id="compra-cant" value="1" min="1"/>
                        </div>
                        <div class="form-group" style="max-width:150px">
                            <label class="form-label">Precio unit. compra</label>
                            <input type="number" class="form-input" id="compra-precio" step="0.01" min="0"/>
                        </div>
                        <button class="btn btn-outline" style="align-self:flex-end" onclick="ComprasController.agregarItem()">
                            ${Utils.icon('plus', 14)} Agregar
                        </button>
                    </div>
                    <div id="compra-carrito-wrap"></div>
                    <div class="total-bar">
                        <span class="total-label">Total:</span>
                        <span class="total-value" id="compra-total">${Utils.currency(0)}</span>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="ComprasController.confirmarCompra()">Confirmar compra</button>
            `
        });

        setTimeout(() => {
            ComprasController._renderDropdown('');
            document.addEventListener('mousedown', ComprasController._cerrarDropdownHandler);
        }, 80);
    },

    _cerrarDropdownHandler(e) {
        const wrap = document.getElementById('compra-prod-wrap');
        if (wrap && !wrap.contains(e.target)) {
            document.getElementById('compra-prod-dropdown')?.classList.remove('open');
            document.getElementById('compra-prod-search')?.classList.remove('dropdown-open');
        }
    },

    _abrirDropdown() {
        const q = document.getElementById('compra-prod-search')?.value || '';
        this._renderDropdown(q);
    },

    _filtrarDropdown(q) {
        this._renderDropdown(q);
    },

    _renderDropdown(q) {
        const dropdown = document.getElementById('compra-prod-dropdown');
        const searchEl = document.getElementById('compra-prod-search');
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
            dropdown.innerHTML = filtered.slice(0, 40).map(p => `<div class="prod-dropdown-item"
                         onclick="ComprasController._seleccionarProducto(${p.id})">
                <span>
                    <span class="prod-item-name">${Utils.escape(p.nombre)}</span>
                    ${p.codigo ? `<span class="prod-item-code"> [${Utils.escape(p.codigo)}]</span>` : ''}
                </span>
                <span class="prod-item-meta">
                    ${Utils.currency(p.precio_compra)}
                    &nbsp;|&nbsp; Stock: ${p.stock || 0}
                </span>
            </div>`).join('');
        }

        dropdown.classList.add('open');
        searchEl?.classList.add('dropdown-open');
    },

    _seleccionarProducto(id) {
        const prod = this._productos.find(p => p.id === id);
        if (!prod) return;
        const hidden = document.getElementById('compra-prod-id');
        if (hidden) {
            hidden.value = id;
            hidden.dataset.nombre = prod.nombre;
            hidden.dataset.codigo = prod.codigo || '';
        }
        const searchEl = document.getElementById('compra-prod-search');
        if (searchEl) searchEl.value = prod.nombre;

        const precioEl = document.getElementById('compra-precio');
        if (precioEl) precioEl.value = prod.precio_compra || 0;

        document.getElementById('compra-prod-dropdown')?.classList.remove('open');
        searchEl?.classList.remove('dropdown-open');
        document.getElementById('compra-cant')?.focus();
    },

    agregarItem() {
        const hidden = document.getElementById('compra-prod-id');
        const prodId = parseInt(hidden?.value, 10);
        const nombre = hidden?.dataset.nombre || '';
        const codigo = hidden?.dataset.codigo || '';
        const cant = parseInt(document.getElementById('compra-cant').value, 10) || 1;
        const precio = parseFloat(document.getElementById('compra-precio').value) || 0;

        if (!prodId || cant < 1) { Toast.warning('Selecciona un producto y completa la cantidad'); return; }
        if (precio < 0) { Toast.warning('El precio no puede ser negativo'); return; }

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
        const wrap = document.getElementById('compra-carrito-wrap');
        if (!wrap) return;
        if (!this._carrito.length) {
            wrap.innerHTML = '<p style="font-size:.82rem;color:var(--gray-400);padding:8px 0">Sin items agregados aun.</p>';
            const tel = document.getElementById('compra-total');
            if (tel) tel.textContent = Utils.currency(0);
            return;
        }
        const rows = this._carrito.map((item, i) => `<tr>
            <td>${Utils.escape(item.producto_nombre)}${item.producto_codigo ? `<br><span class="producto-code">${Utils.escape(item.producto_codigo)}</span>` : ''}</td>
            <td><input type="number" value="${item.cantidad}" min="1"
                       style="width:60px;padding:3px 6px;border:1.5px solid var(--gray-300);border-radius:2px;font-size:.83rem"
                       onchange="ComprasController.updateCantidad(${i}, this.value)"/></td>
            <td>${Utils.currency(item.precio_unitario)}</td>
            <td style="font-weight:600">${Utils.currency(item.subtotal)}</td>
            <td><button class="btn btn-danger btn-sm btn-icon" onclick="ComprasController.quitarItem(${i})">${Utils.icon('trash', 13)}</button></td>
        </tr>`).join('');

        const total = this._carrito.reduce((s, i) => s + i.subtotal, 0);
        wrap.innerHTML = `<table class="cart-table">
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
        const tel = document.getElementById('compra-total');
        if (tel) tel.textContent = Utils.currency(total);
    },

    updateCantidad(i, val) {
        const cant = parseInt(val, 10);
        if (cant < 1) return;
        const item = this._carrito[i];
        if (!item) return;
        item.cantidad = cant;
        item.subtotal = cant * item.precio_unitario;
        this._renderCarrito();
    },

    quitarItem(i) {
        this._carrito.splice(i, 1);
        this._renderCarrito();
    },

    async confirmarCompra() {
        if (!this._carrito.length) { Toast.warning('Agrega al menos un producto'); return; }

        const btnConfirmar = document.querySelector('.modal-footer .btn-primary');
        if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = 'Procesando...'; }

        const sel = document.getElementById('compra-proveedor');
        const proveedorId = parseInt(sel?.value, 10) || null;
        const proveedorNombre = proveedorId ? (sel?.options[sel.selectedIndex]?.dataset.nombre || '') : 'Sin proveedor';
        const notas = document.getElementById('compra-notas')?.value.trim() || '';
        const estadoSeleccionado = document.getElementById('compra-estado')?.value || 'recibida';
        const total = this._carrito.reduce((s, i) => s + i.subtotal, 0);

        try {
            const productosActuales = await Promise.all(
                this._carrito.map(item => SupabaseClient.selectOne('productos', item.producto_id))
            );

            for (let idx = 0; idx < this._carrito.length; idx++) {
                if (!productosActuales[idx]) {
                    throw new Error(`El producto "${this._carrito[idx].producto_nombre}" ya no existe`);
                }
            }

            const compraArr = await SupabaseClient.insert('compras', {
                proveedor_id: proveedorId,
                proveedor_nombre: proveedorNombre,
                total,
                items_count: this._carrito.length,
                estado: estadoSeleccionado,
                notas,
                fecha: WorkDate.get()
            });
            const compra = Array.isArray(compraArr) ? compraArr[0] : compraArr;

            await Promise.all(this._carrito.map(async (item, idx) => {
                await SupabaseClient.insert('compra_items', {
                    compra_id: compra.id,
                    producto_id: item.producto_id,
                    producto_nombre: item.producto_nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    subtotal: item.subtotal
                });
            }));

            if (estadoSeleccionado === 'recibida') {
                await Promise.all(this._carrito.map(async (item, idx) => {
                    const prod = productosActuales[idx];
                    await SupabaseClient.update('productos', item.producto_id, {
                        stock: (prod.stock || 0) + item.cantidad,
                        precio_compra: item.precio_unitario
                    });
                    await SupabaseClient.insert('stock_movimientos', {
                        producto_id: item.producto_id,
                        producto_nombre: item.producto_nombre,
                        tipo: 'entrada',
                        cantidad: item.cantidad,
                        motivo: `Compra #${compra.id} - ${proveedorNombre}`,
                        fecha: WorkDate.get()
                    });
                }));
            }

            const msg = estadoSeleccionado === 'pendiente'
                ? `Compra pendiente registrada - Total: ${Utils.currency(total)}`
                : `Compra registrada - Total: ${Utils.currency(total)}`;
            Toast.success(msg);
            Modal.close();
            this._carrito = [];
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
            const btn = document.querySelector('.modal-footer .btn-primary');
            if (btn) { btn.disabled = false; btn.textContent = 'Confirmar compra'; }
        }
    },

    async verDetalle(compraId) {
        try {
            const [compra, items] = await Promise.all([
                SupabaseClient.selectOne('compras', compraId),
                SupabaseClient.select('compra_items', { select: '*', compra_id: `eq.${compraId}` })
            ]);
            const rows = (items || []).map(i => `<tr>
                <td>${Utils.escape(i.producto_nombre)}</td>
                <td>${i.cantidad}</td>
                <td>${Utils.currency(i.precio_unitario)}</td>
                <td style="font-weight:600">${Utils.currency(i.subtotal)}</td>
            </tr>`).join('');

            Modal.open({
                title: `Compra #${compraId}`,
                size: 'md',
                body: `
                    <div class="venta-detail-header">
                        <div class="detail-field">
                            <span class="detail-field-label">Fecha</span>
                            <span class="detail-field-value">${Utils.date(compra?.fecha || compra?.created_at)}</span>
                        </div>
                        <div class="detail-field">
                            <span class="detail-field-label">Proveedor</span>
                            <span class="detail-field-value">${Utils.escape(compra?.proveedor_nombre || 'Sin proveedor')}</span>
                        </div>
                        <div class="detail-field">
                            <span class="detail-field-label">Estado</span>
                            <span class="detail-field-value">${Utils.statusBadge(compra?.estado)}</span>
                        </div>
                    </div>
                    ${compra?.notas ? `<p style="font-size:.83rem;color:var(--gray-500);margin-bottom:14px">Notas: ${Utils.escape(compra.notas)}</p>` : ''}
                    <div class="table-wrapper">
                        <table class="table">
                            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">Sin items</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div class="total-bar" style="margin-top:10px">
                        <span class="total-label">Total:</span>
                        <span class="total-value">${Utils.currency(compra?.total)}</span>
                    </div>
                `
            });
        } catch (err) { Toast.error(err.message); }
    },

    async recibirCompra(id) {
        Modal.confirm({
            title: 'Marcar como recibida',
            message: `Confirmar recepcion de la compra #${id}? Se actualizara el stock de los productos.`,
            onConfirm: async () => {
                try {
                    const [compra, items] = await Promise.all([
                        SupabaseClient.selectOne('compras', id),
                        SupabaseClient.select('compra_items', { select: '*', compra_id: `eq.${id}` })
                    ]);
                    if (!compra) throw new Error('Compra no encontrada');
                    if (compra.estado !== 'pendiente') { Toast.info('La compra ya no esta pendiente'); return; }

                    const productosActuales = await Promise.all(
                        items.map(item => SupabaseClient.selectOne('productos', item.producto_id))
                    );
                    const today = new Date().toLocaleDateString('sv');

                    await Promise.all(items.map(async (item, idx) => {
                        const prod = productosActuales[idx];
                        if (!prod) return;
                        await SupabaseClient.update('productos', item.producto_id, {
                            stock: (prod.stock || 0) + item.cantidad,
                            precio_compra: item.precio_unitario
                        });
                        await SupabaseClient.insert('stock_movimientos', {
                            producto_id: item.producto_id,
                            producto_nombre: item.producto_nombre,
                            tipo: 'entrada',
                            cantidad: item.cantidad,
                            motivo: `Recepcion compra #${id} - ${compra.proveedor_nombre || 'Sin proveedor'}`,
                            fecha: today
                        });
                    }));

                    await SupabaseClient.update('compras', id, { estado: 'recibida' });
                    Toast.success('Compra marcada como recibida y stock actualizado');
                    await this._load();
                    this._draw(document.getElementById('app-view'));
                } catch (err) { Toast.error(err.message); }
            }
        });
    },

    cancelarCompra(id, esPendiente = false) {
        const message = esPendiente
            ? `Cancelar la compra pendiente #${id}? No afectara el stock ya que la mercaderia no fue recibida.`
            : `Cancelar la compra #${id}? Se intentara revertir el stock ingresado.`;
        Modal.confirm({
            title: 'Cancelar compra',
            message,
            danger: true,
            onConfirm: async () => {
                try {
                    const compra = await SupabaseClient.selectOne('compras', id);
                    if (!compra) throw new Error('Compra no encontrada');
                    if (compra.estado === 'cancelada') { Toast.info('La compra ya esta cancelada'); return; }

                    if (compra.estado === 'pendiente') {
                        await SupabaseClient.update('compras', id, { estado: 'cancelada' });
                        Toast.success('Compra cancelada');
                    } else {
                        const items = await SupabaseClient.select('compra_items', { select: '*', compra_id: `eq.${id}` });
                        const productosActuales = await Promise.all(
                            items.map(item => SupabaseClient.selectOne('productos', item.producto_id))
                        );

                        for (let idx = 0; idx < items.length; idx++) {
                            const prod = productosActuales[idx];
                            const item = items[idx];
                            if (!prod) continue;
                            if ((prod.stock || 0) < item.cantidad) {
                                throw new Error(`No se puede cancelar. El stock actual de "${item.producto_nombre}" es menor al ingresado por esta compra.`);
                            }
                        }

                        await Promise.all(items.map(async (item, idx) => {
                            const prod = productosActuales[idx];
                            if (!prod) return;
                            await SupabaseClient.update('productos', item.producto_id, {
                                stock: (prod.stock || 0) - item.cantidad
                            });
                            await SupabaseClient.insert('stock_movimientos', {
                                producto_id: item.producto_id,
                                producto_nombre: item.producto_nombre,
                                tipo: 'salida',
                                cantidad: -item.cantidad,
                                motivo: `Cancelacion compra #${id}`,
                                fecha: new Date().toLocaleDateString('sv')
                            });
                        }));

                        await SupabaseClient.update('compras', id, { estado: 'cancelada' });
                        Toast.success('Compra cancelada y stock revertido');
                    }

                    await this._load();
                    this._draw(document.getElementById('app-view'));
                } catch (err) { Toast.error(err.message); }
            }
        });
    }
};

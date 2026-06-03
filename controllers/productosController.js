// ============================================================
// productosController.js
// ============================================================
const ProductosController = {
    _productos: [],
    _categorias: [],
    _search: '',
    _catFilter: '',
    _showInactive: false,
    _page: 0,
    _pageSize: 150,

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        await this._load();
        this._draw(view);
    },

    async _load() {
        const [prods, cats] = await Promise.all([
            SupabaseClient.select('productos', { select: '*', order: 'nombre.asc', limit: 3000 }),
            SupabaseClient.select('categorias', { select: '*', order: 'nombre.asc' })
        ]);
        this._productos = prods || [];
        this._categorias = cats || [];
    },

    _draw(view) {
        const cats = this._categorias;
        const catOptions = cats.map(c => `<option value="${Utils.escape(c.nombre)}">${Utils.escape(c.nombre)}</option>`).join('');
        const visibles = this._showInactive
            ? this._productos.filter(p => p.activo === false)
            : this._productos.filter(p => p.activo !== false);
        const stockBajo = visibles.filter(p => (p.stock || 0) <= CONFIG.STOCK_MINIMO).length;
        const inventarioCosto = visibles.reduce((sum, p) => sum + ((p.stock || 0) * parseFloat(p.precio_compra || 0)), 0);
        const inventarioVenta = visibles.reduce((sum, p) => sum + ((p.stock || 0) * parseFloat(p.precio || 0)), 0);

        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Productos</h2>
                    <p>${this._productos.filter(p => p.activo !== false).length} producto(s) activo(s) en catalogo</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-outline btn-sm" onclick="ProductosController.toggleInactiveView()">${this._showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}</button>
                    <button class="btn btn-outline btn-sm" onclick="ProductosController.openCategorias()">Categorias</button>
                    <button class="btn btn-outline btn-sm" onclick="ProductosController.openMargenGlobal()">% Margen global</button>
                    <button class="btn btn-primary" onclick="ProductosController.openForm()">
                        ${Utils.icon('plus')} Nuevo producto
                    </button>
                </div>
            </div>

            <div class="kpi-row" style="margin-bottom:18px">
                <div class="kpi-card">
                    <span class="kpi-label">Inventario al costo</span>
                    <span class="kpi-value">${Utils.currency(inventarioCosto)}</span>
                    <span class="kpi-sub">capital inmovilizado</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Valor potencial de venta</span>
                    <span class="kpi-value">${Utils.currency(inventarioVenta)}</span>
                    <span class="kpi-sub">si se vende el stock actual</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-label">Stock bajo</span>
                    <span class="kpi-value" style="color:${stockBajo ? '#dc2626' : 'inherit'}">${stockBajo}</span>
                    <span class="kpi-sub">${visibles.length} visible(s) con minimo de ${CONFIG.STOCK_MINIMO}</span>
                </div>
            </div>

            <div class="productos-filters">
                <div class="search-bar" style="flex:1;min-width:200px">
                    <span class="search-icon">${Utils.icon('search', 16)}</span>
                    <input type="text" id="prod-search" placeholder="Buscar por nombre, codigo o descripcion..."
                           value="${Utils.escape(this._search)}"
                           oninput="ProductosController.onSearch(this.value)"/>
                </div>
                <select class="categoria-filter" id="cat-filter" onchange="ProductosController.onCatFilter(this.value)">
                    <option value="">Todas las categorias</option>
                    ${catOptions}
                </select>
            </div>

            <div class="card" style="padding:0">
                <div class="table-wrapper">
                    ${this._buildTable()}
                </div>
            </div>
        `;
        if (this._catFilter) {
            const sel = view.querySelector('#cat-filter');
            if (sel) sel.value = this._catFilter;
        }
    },

    _filtered() {
        let list = this._showInactive
            ? this._productos.filter(p => p.activo === false)
            : this._productos.filter(p => p.activo !== false);
        if (this._search) {
            const q = Utils.normalizeText(this._search);
            list = list.filter(p =>
                Utils.normalizeText(p.nombre).includes(q) ||
                Utils.normalizeText(p.codigo).includes(q) ||
                Utils.normalizeText(p.descripcion || '').includes(q)
            );
        }
        if (this._catFilter) list = list.filter(p => p.categoria === this._catFilter);
        return list;
    },

    isActive(prod) {
        return prod?.activo !== false;
    },

    toggleInactiveView() {
        this._showInactive = !this._showInactive;
        this._draw(document.getElementById('app-view'));
    },

    goToPage(n) {
        const total = this._filtered().length;
        const totalPages = Math.ceil(total / this._pageSize) || 1;
        this._page = Math.max(0, Math.min(n, totalPages - 1));
        const wrapper = document.querySelector('#app-view .table-wrapper');
        if (wrapper) wrapper.innerHTML = this._buildTable();
    },

    _buildTable() {
        const all = this._filtered();
        if (!all.length) return '<div class="empty-state"><span class="empty-icon"><> </span><p>No se encontraron productos</p></div>';
        const totalPages = Math.ceil(all.length / this._pageSize) || 1;
        if (this._page >= totalPages) this._page = totalPages - 1;
        const start = this._page * this._pageSize;
        const rows = all.slice(start, start + this._pageSize);

        const body = rows.map(p => {
            const stockClass = (p.stock || 0) <= CONFIG.STOCK_MINIMO ? 'stock-low' : 'stock-ok';
            const margen = parseFloat(p.precio || 0) - parseFloat(p.precio_compra || 0);
            const active = this.isActive(p);
            return `<tr>
                <td><span class="producto-code">${Utils.escape(p.codigo || '-')}</span></td>
                <td><strong>${Utils.escape(p.nombre)}</strong>${!active ? ` <span class="badge badge-danger">inactivo</span>` : ''}${p.descripcion ? `<br><small>${Utils.escape(Utils.truncate(p.descripcion, 40))}</small>` : ''}</td>
                <td>${Utils.escape(p.categoria || '-')}</td>
                <td class="precio-cell">${Utils.currency(p.precio_compra)}</td>
                <td class="precio-cell">${Utils.currency(p.precio)}</td>
                <td style="color:${margen < 0 ? '#dc2626' : '#16a34a'}">${Utils.currency(margen)}</td>
                <td><span class="${stockClass}" style="font-weight:600">${Utils.number(p.stock)}</span></td>
                <td>
                    <div class="actions">
                        <button class="btn btn-outline btn-sm btn-icon" title="Editar" onclick="ProductosController.openForm(${p.id})">${Utils.icon('edit', 14)}</button>
                        <button class="btn btn-outline btn-sm" title="${active ? 'Inactivar' : 'Reactivar'}" onclick="ProductosController.toggleActive(${p.id})">${active ? 'Inactivar' : 'Activar'}</button>
                        <button class="btn btn-danger btn-sm btn-icon" title="Eliminar" onclick="ProductosController.confirmDelete(${p.id})">${Utils.icon('trash', 14)}</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        const pagination = totalPages > 1 ? `
            <div class="table-pagination">
                <span class="table-pagination-info">${start + 1}–${Math.min(start + this._pageSize, all.length)} de ${all.length}</span>
                <button class="btn btn-outline btn-sm" onclick="ProductosController.goToPage(${this._page - 1})" ${this._page === 0 ? 'disabled' : ''}>← Ant</button>
                <button class="btn btn-outline btn-sm" onclick="ProductosController.goToPage(${this._page + 1})" ${this._page >= totalPages - 1 ? 'disabled' : ''}>Sig →</button>
            </div>
        ` : '';

        return `<table class="table">
            <thead><tr>
                <th>Codigo</th><th>Nombre</th><th>Categoria</th>
                <th>P. Compra</th><th>P. Venta</th><th>Margen</th><th>Stock</th><th></th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>${pagination}`;
    },

    onSearch: Utils.debounce(function(val) {
        ProductosController._search = val;
        ProductosController._page = 0;
        const view = document.getElementById('app-view');
        if (view) {
            const wrapper = view.querySelector('.table-wrapper');
            if (wrapper) wrapper.innerHTML = ProductosController._buildTable();
        }
    }, 300),

    onCatFilter(val) {
        this._catFilter = val;
        this._page = 0;
        const view = document.getElementById('app-view');
        if (view) {
            const wrapper = view.querySelector('.table-wrapper');
            if (wrapper) wrapper.innerHTML = this._buildTable();
        }
    },

    async openForm(id = null) {
        const cats = this._categorias;
        const catOpts = cats.map(c => `<option value="${Utils.escape(c.nombre)}">${Utils.escape(c.nombre)}</option>`).join('');
        let prod = { codigo: '', nombre: '', descripcion: '', categoria: '', precio_compra: 0, precio: 0, stock: 0 };
        if (id) prod = this._productos.find(p => p.id === id) || prod;
        const active = this.isActive(prod);

        Modal.open({
            title: id ? 'Editar producto' : 'Nuevo producto',
            size: 'md',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Codigo</label>
                        <input class="form-input" id="p-codigo" value="${Utils.escape(prod.codigo || '')}" placeholder="SKU-001"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Nombre</label>
                        <input class="form-input" id="p-nombre" value="${Utils.escape(prod.nombre)}" required/>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Descripcion</label>
                    <textarea class="form-textarea" id="p-desc">${Utils.escape(prod.descripcion || '')}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Categoria</label>
                        <select class="form-select" id="p-cat">
                            <option value="">Sin categoria</option>
                            ${catOpts}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stock inicial</label>
                        <input type="number" class="form-input" id="p-stock" value="${prod.stock || 0}" min="0" ${id ? 'disabled title="Modifica el stock desde la seccion Stock"' : ''}/>
                        ${id ? '<span class="form-hint">Modifica el stock desde la seccion Stock</span>' : ''}
                    </div>
                </div>
                <div class="form-row">
                    ${id ? `<div class="form-group">
                        <label class="form-label">Estado</label>
                        <input class="form-input" value="${active ? 'Activo' : 'Inactivo'}" disabled/>
                    </div>` : ''}
                    <div class="form-group">
                        <label class="form-label">Precio de compra</label>
                        <input type="number" class="form-input" id="p-pcompra" value="${prod.precio_compra || 0}" min="0" step="0.01"
                               oninput="ProductosController.recalcMargen()"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Margen (%)</label>
                        <input type="number" class="form-input" id="p-margen" placeholder="ej: 70" min="0" step="0.01"
                               oninput="ProductosController.aplicarMargen()"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio de venta</label>
                        <input type="number" class="form-input" id="p-pventa" value="${prod.precio || 0}" min="0" step="0.01"
                               oninput="ProductosController.recalcMargenDesdeVenta()"/>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="ProductosController.save(${id || 'null'})">
                    ${id ? 'Guardar cambios' : 'Crear producto'}
                </button>
            `
        });
        if (prod.categoria) {
            setTimeout(() => {
                const sel = document.getElementById('p-cat');
                if (sel) sel.value = prod.categoria;
            }, 50);
        }
    },

    _findDuplicateProducto({ id = null, codigo = '', nombre = '' }) {
        const codigoNorm = Utils.normalizeText(codigo);
        const nombreNorm = Utils.normalizeText(nombre);
        return this._productos.find(p =>
            p.id !== id && (
                (codigoNorm && Utils.normalizeText(p.codigo) === codigoNorm) ||
                Utils.normalizeText(p.nombre) === nombreNorm
            )
        );
    },

    async save(id) {
        const nombre = document.getElementById('p-nombre').value.trim();
        const codigo = document.getElementById('p-codigo').value.trim();
        const precioCompra = parseFloat(document.getElementById('p-pcompra').value);
        const precioVenta = parseFloat(document.getElementById('p-pventa').value);
        const stockInicial = parseInt(document.getElementById('p-stock')?.value || '0', 10);

        if (!nombre) { Toast.warning('El nombre es obligatorio'); return; }
        if (Number.isNaN(precioCompra) || precioCompra < 0 || Number.isNaN(precioVenta) || precioVenta < 0) {
            Toast.warning('Los precios deben ser validos');
            return;
        }
        if (!id && (Number.isNaN(stockInicial) || stockInicial < 0)) {
            Toast.warning('El stock inicial debe ser 0 o mayor');
            return;
        }

        const duplicate = this._findDuplicateProducto({ id, codigo, nombre });
        if (duplicate) {
            Toast.warning('Ya existe un producto con ese nombre o codigo');
            return;
        }

        const data = {
            codigo,
            nombre,
            descripcion: document.getElementById('p-desc').value.trim(),
            categoria:   document.getElementById('p-cat').value,
            precio_compra: precioCompra,
            precio: precioVenta
        };
        if (!id) data.stock = stockInicial;

        try {
            if (id) {
                await SupabaseClient.update('productos', id, data);
                Toast.success('Producto actualizado');
            } else {
                await SupabaseClient.insert('productos', data);
                Toast.success('Producto creado');
            }
            Modal.close();
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async toggleActive(id) {
        const prod = this._productos.find(p => p.id === id);
        if (!prod) return;
        const willBeActive = !this.isActive(prod);
        try {
            await SupabaseClient.update('productos', id, { activo: willBeActive });
            Toast.success(`Producto ${willBeActive ? 'activado' : 'inactivado'}`);
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
        }
    },

    confirmDelete(id) {
        const nombre = this._productos.find(p => p.id === id)?.nombre || '';
        Modal.confirm({
            title: 'Eliminar producto',
            message: `Eliminar "${nombre}"? Esta accion no se puede deshacer.`,
            danger: true,
            onConfirm: () => this.delete(id)
        });
    },

    async delete(id) {
        try {
            const [ventaItems, compraItems, movimientos] = await Promise.all([
                SupabaseClient.select('venta_items', { select: 'id', producto_id: `eq.${id}`, limit: 1 }),
                SupabaseClient.select('compra_items', { select: 'id', producto_id: `eq.${id}`, limit: 1 }),
                SupabaseClient.select('stock_movimientos', { select: 'id', producto_id: `eq.${id}`, limit: 1 })
            ]);
            if (ventaItems.length || compraItems.length || movimientos.length) {
                Toast.warning('No se puede eliminar un producto con historial. Dejalo inactivo o sin stock.');
                return;
            }

            await SupabaseClient.delete('productos', id);
            Toast.success('Producto eliminado');
            await this._load();
            this._draw(document.getElementById('app-view'));
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ── Helpers de margen en el formulario individual ────────
    aplicarMargen() {
        const compra = parseFloat(document.getElementById('p-pcompra')?.value) || 0;
        const margen = parseFloat(document.getElementById('p-margen')?.value);
        if (!Number.isNaN(margen) && margen >= 0 && compra > 0) {
            const venta = compra * (1 + margen / 100);
            document.getElementById('p-pventa').value = venta.toFixed(2);
        }
    },

    recalcMargen() {
        // Al cambiar precio de compra, si hay margen cargado lo recalcula
        const margen = parseFloat(document.getElementById('p-margen')?.value);
        if (!Number.isNaN(margen) && margen >= 0) {
            this.aplicarMargen();
        }
    },

    recalcMargenDesdeVenta() {
        // Al editar precio de venta a mano, actualiza el campo margen
        const compra = parseFloat(document.getElementById('p-pcompra')?.value) || 0;
        const venta  = parseFloat(document.getElementById('p-pventa')?.value)  || 0;
        const margenEl = document.getElementById('p-margen');
        if (margenEl && compra > 0) {
            const m = ((venta - compra) / compra) * 100;
            margenEl.value = m >= 0 ? m.toFixed(2) : '';
        }
    },

    // ── Margen global sobre todos los productos activos ──────
    openMargenGlobal() {
        const activos = this._productos.filter(p => p.activo !== false);
        Modal.open({
            title: 'Aplicar margen global',
            size: 'sm',
            body: `
                <p style="margin:0 0 16px;color:var(--gray-500);font-size:14px">
                    Calcula el precio de venta de <strong>${activos.length} producto${activos.length !== 1 ? 's' : ''} activo${activos.length !== 1 ? 's' : ''}</strong>
                    aplicando el porcentaje sobre el precio de compra de cada uno.<br>
                    <span style="font-size:12px">precio de venta = precio de compra × (1 + margen / 100)</span>
                </p>
                <div class="form-group">
                    <label class="form-label required">Margen de ganancia (%)</label>
                    <input type="number" class="form-input" id="margen-global-val" placeholder="ej: 20" min="0" step="0.01" autofocus/>
                    <span class="form-hint" id="margen-global-preview"></span>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="ProductosController.aplicarMargenGlobal()">
                    Aplicar a ${activos.length} productos
                </button>
            `
        });
        setTimeout(() => {
            const input = document.getElementById('margen-global-val');
            if (input) {
                input.focus();
                input.addEventListener('input', () => {
                    const m = parseFloat(input.value);
                    const preview = document.getElementById('margen-global-preview');
                    if (!preview) return;
                    if (!Number.isNaN(m) && m >= 0) {
                        const ej = activos.find(p => parseFloat(p.precio_compra) > 0);
                        if (ej) {
                            const nuevo = (parseFloat(ej.precio_compra) * (1 + m / 100)).toFixed(2);
                            preview.textContent = `Ej: ${ej.nombre} → ${Utils.currency(nuevo)}`;
                        }
                    } else {
                        preview.textContent = '';
                    }
                });
            }
        }, 50);
    },

    async aplicarMargenGlobal() {
        const margen = parseFloat(document.getElementById('margen-global-val')?.value);
        if (Number.isNaN(margen) || margen < 0) {
            Toast.warning('Ingresá un porcentaje válido');
            return;
        }

        const activos = this._productos.filter(p => p.activo !== false);
        if (!activos.length) { Toast.warning('No hay productos activos'); return; }

        Modal.close();

        const conPrecio = activos.filter(p => parseFloat(p.precio_compra) > 0);
        const sinPrecio = activos.length - conPrecio.length;

        if (!conPrecio.length) {
            Toast.warning('Ningún producto tiene precio de compra cargado');
            return;
        }

        // Overlay de progreso
        const overlay = document.createElement('div');
        overlay.id = 'margen-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:8px;padding:32px 40px;text-align:center;min-width:300px;max-width:360px">
                <div style="font-size:1rem;font-weight:700;margin-bottom:8px">Aplicando margen global...</div>
                <div id="margen-prog-text" style="font-size:2rem;font-weight:800;margin-bottom:14px">0 de ${conPrecio.length}</div>
                <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden">
                    <div id="margen-prog-bar" style="height:100%;background:#0a0a0a;transition:width .1s;width:0%"></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        let ok = 0, skip = sinPrecio;
        const BATCH = 25;

        for (let i = 0; i < conPrecio.length; i += BATCH) {
            document.getElementById('margen-prog-text').textContent = `${i} de ${conPrecio.length}`;
            document.getElementById('margen-prog-bar').style.width = `${Math.round(i / conPrecio.length * 100)}%`;

            const chunk = conPrecio.slice(i, i + BATCH);
            const results = await Promise.allSettled(
                chunk.map(prod => {
                    const nuevoPrecio = parseFloat((parseFloat(prod.precio_compra) * (1 + margen / 100)).toFixed(2));
                    return SupabaseClient.update('productos', prod.id, { precio: nuevoPrecio });
                })
            );
            ok   += results.filter(r => r.status === 'fulfilled').length;
            skip += results.filter(r => r.status === 'rejected').length;
        }

        overlay.remove();

        if (ok)   Toast.success(`Margen del ${margen}% aplicado a ${ok} producto${ok !== 1 ? 's' : ''}`);
        if (skip) Toast.warning(`${skip} producto${skip !== 1 ? 's' : ''} omitido${skip !== 1 ? 's' : ''} (sin precio de compra)`);

        await this._load();
        this._draw(document.getElementById('app-view'));
    },

    async openCategorias() {
        const render = () => {
            const rows = this._categorias.map(c => `
                <tr>
                    <td>${Utils.escape(c.nombre)}</td>
                    <td><div class="actions">
                        <button class="btn btn-danger btn-sm btn-icon" onclick="ProductosController.deleteCategoria(${c.id})">${Utils.icon('trash', 14)}</button>
                    </div></td>
                </tr>
            `).join('');

            return `
                <div class="form-row" style="margin-bottom:14px">
                    <div class="form-group" style="margin:0;flex:1">
                        <input class="form-input" id="new-cat" placeholder="Nueva categoria..."/>
                    </div>
                    <button class="btn btn-primary" onclick="ProductosController.addCategoria()">Agregar</button>
                </div>
                <div class="table-wrapper">
                    <table class="table"><thead><tr><th>Nombre</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="2" style="text-align:center;color:var(--gray-400)">Sin categorias</td></tr>'}</tbody>
                    </table>
                </div>
            `;
        };

        Modal.open({ title: 'Categorias', size: 'sm', body: render() });
    },

    async addCategoria() {
        const input = document.getElementById('new-cat');
        const nombre = input?.value.trim();
        if (!nombre) return;

        const exists = this._categorias.some(c => Utils.normalizeText(c.nombre) === Utils.normalizeText(nombre));
        if (exists) {
            Toast.warning('Esa categoria ya existe');
            return;
        }

        try {
            await SupabaseClient.insert('categorias', { nombre });
            Toast.success('Categoria creada');
            await this._load();
            this.openCategorias();
        } catch (err) { Toast.error(err.message); }
    },

    async deleteCategoria(id) {
        const cat = this._categorias.find(c => c.id === id);
        if (!cat) return;
        const nombre = cat.nombre;
        Modal.confirm({
            title: 'Eliminar categoria',
            message: `Eliminar categoria "${nombre}"?`,
            danger: true,
            onConfirm: async () => {
                try {
                    const productsUsingCategory = await SupabaseClient.select('productos', {
                        select: 'id',
                        categoria: `eq.${nombre}`,
                        limit: 1
                    });
                    if (productsUsingCategory.length) {
                        Toast.warning('No se puede eliminar una categoria que esta en uso');
                        return;
                    }

                    await SupabaseClient.delete('categorias', id);
                    Toast.success('Categoria eliminada');
                    await this._load();
                    this.openCategorias();
                } catch (err) { Toast.error(err.message); }
            }
        });
    }
};

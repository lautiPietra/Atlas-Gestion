// ============================================================
// productosController.js
// ============================================================
const ProductosController = {
    _productos: [],
    _categorias: [],
    _search: '',
    _catFilter: '',
    _showInactive: false,

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        await this._load();
        this._draw(view);
    },

    async _load() {
        const [prods, cats] = await Promise.all([
            SupabaseClient.select('productos', { select: '*', order: 'nombre.asc' }),
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

    _buildTable() {
        const rows = this._filtered();
        if (!rows.length) return '<div class="empty-state"><span class="empty-icon"><> </span><p>No se encontraron productos</p></div>';

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

        return `<table class="table">
            <thead><tr>
                <th>Codigo</th><th>Nombre</th><th>Categoria</th>
                <th>P. Compra</th><th>P. Venta</th><th>Margen</th><th>Stock</th><th></th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    onSearch: Utils.debounce(function(val) {
        ProductosController._search = val;
        const view = document.getElementById('app-view');
        if (view) {
            const wrapper = view.querySelector('.table-wrapper');
            if (wrapper) wrapper.innerHTML = ProductosController._buildTable();
        }
    }, 300),

    onCatFilter(val) {
        this._catFilter = val;
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
                        <input type="number" class="form-input" id="p-pcompra" value="${prod.precio_compra || 0}" min="0" step="0.01"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Precio de venta</label>
                        <input type="number" class="form-input" id="p-pventa" value="${prod.precio || 0}" min="0" step="0.01"/>
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

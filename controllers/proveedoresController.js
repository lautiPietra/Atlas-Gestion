// ============================================================
// proveedoresController.js
// ============================================================
const ProveedoresController = {
    _proveedores: [],
    _search: '',
    _showInactive: false,

    async render(view) {
        view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
        this._proveedores = await SupabaseClient.select('proveedores', { select: '*', order: 'nombre.asc' }) || [];
        this._draw(view);
    },

    _draw(view) {
        const visibles = this._proveedores.filter(p => this._showInactive || this.isActive(p));
        view.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h2>Proveedores</h2>
                    <p>${visibles.length} proveedor(es) visibles</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-outline btn-sm" onclick="ProveedoresController.toggleInactiveView()">${this._showInactive ? 'Ocultar inactivos' : 'Ver inactivos'}</button>
                    <button class="btn btn-primary" onclick="ProveedoresController.openForm()">
                        ${Utils.icon('plus')} Nuevo proveedor
                    </button>
                </div>
            </div>
            <div class="productos-filters">
                <div class="search-bar" style="flex:1;max-width:420px">
                    <span class="search-icon">${Utils.icon('search', 16)}</span>
                    <input type="text" placeholder="Buscar por nombre, CUIT o email..."
                           value="${Utils.escape(this._search)}"
                           oninput="ProveedoresController.onSearch(this.value)"/>
                </div>
            </div>
            <div class="card" style="padding:0">
                <div class="table-wrapper" id="prov-table">${this._buildTable()}</div>
            </div>
        `;
    },

    _filtered() {
        const base = this._proveedores.filter(p => this._showInactive || this.isActive(p));
        if (!this._search) return base;
        const q = Utils.normalizeText(this._search);
        return base.filter(p =>
            Utils.normalizeText(p.nombre).includes(q) ||
            Utils.normalizeText(p.cuit).includes(q) ||
            Utils.normalizeText(p.email).includes(q) ||
            Utils.normalizeText(p.contacto).includes(q)
        );
    },

    isActive(proveedor) {
        return !Utils.hasInactiveMarker(proveedor?.notas);
    },

    toggleInactiveView() {
        this._showInactive = !this._showInactive;
        this._draw(document.getElementById('app-view'));
    },

    _buildTable() {
        const rows = this._filtered();
        if (!rows.length) return '<div class="empty-state"><span class="empty-icon">[]</span><p>No se encontraron proveedores</p></div>';
        const body = rows.map(p => `<tr>
            <td><strong>${Utils.escape(p.nombre)}</strong>${!this.isActive(p) ? ' <span class="badge badge-danger">inactivo</span>' : ''}</td>
            <td>${Utils.escape(p.contacto || '-')}</td>
            <td>${Utils.escape(p.email || '-')}</td>
            <td>${Utils.escape(p.telefono || '-')}</td>
            <td><span class="producto-code">${Utils.escape(p.cuit || '-')}</span></td>
            <td><div class="actions">
                <button class="btn btn-outline btn-sm btn-icon" onclick="ProveedoresController.openForm(${p.id})">${Utils.icon('edit', 14)}</button>
                <button class="btn btn-outline btn-sm btn-icon" onclick="ProveedoresController.verHistorial(${p.id})">${Utils.icon('eye', 14)}</button>
                <button class="btn btn-outline btn-sm" onclick="ProveedoresController.toggleActive(${p.id})">${this.isActive(p) ? 'Inactivar' : 'Activar'}</button>
                <button class="btn btn-danger btn-sm btn-icon" onclick="ProveedoresController.confirmDelete(${p.id})">${Utils.icon('trash', 14)}</button>
            </div></td>
        </tr>`).join('');

        return `<table class="table">
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Email</th><th>Telefono</th><th>CUIT</th><th></th></tr></thead>
            <tbody>${body}</tbody>
        </table>`;
    },

    onSearch: Utils.debounce(function(val) {
        ProveedoresController._search = val;
        const el = document.getElementById('prov-table');
        if (el) el.innerHTML = ProveedoresController._buildTable();
    }, 300),

    openForm(id = null) {
        const p = id ? this._proveedores.find(x => x.id === id) : {};
        const f = p || {};
        Modal.open({
            title: id ? 'Editar proveedor' : 'Nuevo proveedor',
            size: 'md',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">Nombre / Razon social</label>
                        <input class="form-input" id="pv-nombre" value="${Utils.escape(f.nombre || '')}"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Contacto</label>
                        <input class="form-input" id="pv-contacto" value="${Utils.escape(f.contacto || '')}"/>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="pv-email" value="${Utils.escape(f.email || '')}"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Telefono</label>
                        <input class="form-input" id="pv-tel" value="${Utils.escape(f.telefono || '')}"/>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">CUIT</label>
                        <input class="form-input" id="pv-cuit" placeholder="20-12345678-9" value="${Utils.escape(f.cuit || '')}"/>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Direccion</label>
                        <input class="form-input" id="pv-dir" value="${Utils.escape(f.direccion || '')}"/>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-textarea" id="pv-notas">${Utils.escape(Utils.stripInactiveMarker(f.notas || ''))}</textarea>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" onclick="ProveedoresController.save(${id || 'null'})">${id ? 'Guardar cambios' : 'Crear proveedor'}</button>
            `
        });
    },

    _findDuplicate({ id = null, email = '', cuit = '' }) {
        const emailNorm = Utils.normalizeText(email);
        const cuitNorm = Utils.normalizeText(cuit);
        return this._proveedores.find(p =>
            p.id !== id && (
                (emailNorm && Utils.normalizeText(p.email) === emailNorm) ||
                (cuitNorm && Utils.normalizeText(p.cuit) === cuitNorm)
            )
        );
    },

    async save(id) {
        const nombre = document.getElementById('pv-nombre').value.trim();
        const email = document.getElementById('pv-email').value.trim();
        const cuit = document.getElementById('pv-cuit').value.trim();
        if (!nombre) { Toast.warning('El nombre es obligatorio'); return; }

        const duplicate = this._findDuplicate({ id, email, cuit });
        if (duplicate) {
            Toast.warning('Ya existe un proveedor con ese email o CUIT');
            return;
        }

        const data = {
            nombre,
            contacto: document.getElementById('pv-contacto').value.trim(),
            email,
            telefono: document.getElementById('pv-tel').value.trim(),
            cuit,
            direccion: document.getElementById('pv-dir').value.trim(),
            notas: Utils.withInactiveMarker(
                document.getElementById('pv-notas').value.trim(),
                id ? !this.isActive(this._proveedores.find(p => p.id === id)) : false
            )
        };
        try {
            if (id) {
                await SupabaseClient.update('proveedores', id, data);
                Toast.success('Proveedor actualizado');
            } else {
                await SupabaseClient.insert('proveedores', data);
                Toast.success('Proveedor creado');
            }
            Modal.close();
            this._proveedores = await SupabaseClient.select('proveedores', { select: '*', order: 'nombre.asc' }) || [];
            this._draw(document.getElementById('app-view'));
        } catch (err) { Toast.error(err.message); }
    },

    async toggleActive(id) {
        const proveedor = this._proveedores.find(p => p.id === id);
        if (!proveedor) return;
        const willBeActive = !this.isActive(proveedor);
        try {
            await SupabaseClient.update('proveedores', id, {
                notas: Utils.withInactiveMarker(proveedor.notas || '', !willBeActive)
            });
            Toast.success(`Proveedor ${willBeActive ? 'activado' : 'inactivado'}`);
            this._proveedores = await SupabaseClient.select('proveedores', { select: '*', order: 'nombre.asc' }) || [];
            this._draw(document.getElementById('app-view'));
        } catch (err) { Toast.error(err.message); }
    },

    async verHistorial(proveedorId) {
        const nombre = this._proveedores.find(p => p.id === proveedorId)?.nombre || '';
        try {
            const compras = await SupabaseClient.select('compras', {
                select: 'id,total,created_at,estado,items_count',
                proveedor_id: `eq.${proveedorId}`,
                order: 'created_at.desc',
                limit: 20
            });
            const totalAcum = compras.filter(c => c.estado !== 'cancelada').reduce((s, c) => s + parseFloat(c.total || 0), 0);
            const rows = compras.map(c => `<tr>
                <td>${Utils.date(c.created_at)}</td>
                <td>${c.items_count || 0} item(s)</td>
                <td>${Utils.currency(c.total)}</td>
                <td>${Utils.statusBadge(c.estado)}</td>
            </tr>`).join('');

            Modal.open({
                title: `Compras - ${nombre}`,
                size: 'md',
                body: `
                    <p style="margin-bottom:14px;font-size:.85rem;color:var(--gray-500)">
                        Total acumulado no cancelado: <strong style="color:var(--black)">${Utils.currency(totalAcum)}</strong> en ${compras.length} compra(s)
                    </p>
                    <div class="table-wrapper">
                        <table class="table">
                            <thead><tr><th>Fecha</th><th>Items</th><th>Total</th><th>Estado</th></tr></thead>
                            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">Sin compras</td></tr>'}</tbody>
                        </table>
                    </div>
                `
            });
        } catch (err) { Toast.error(err.message); }
    },

    confirmDelete(id) {
        const nombre = this._proveedores.find(p => p.id === id)?.nombre || '';
        Modal.confirm({
            title: 'Eliminar proveedor',
            message: `Eliminar a "${nombre}"?`,
            danger: true,
            onConfirm: async () => {
                try {
                    const compras = await SupabaseClient.select('compras', { select: 'id', proveedor_id: `eq.${id}`, limit: 1 });
                    if (compras.length) {
                        Toast.warning('No se puede eliminar un proveedor con compras asociadas');
                        return;
                    }
                    await SupabaseClient.delete('proveedores', id);
                    Toast.success('Proveedor eliminado');
                    this._proveedores = await SupabaseClient.select('proveedores', { select: '*', order: 'nombre.asc' }) || [];
                    this._draw(document.getElementById('app-view'));
                } catch (err) { Toast.error(err.message); }
            }
        });
    }
};

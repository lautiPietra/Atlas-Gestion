// ============================================================
// demoClient.js — SupabaseClient simulado, 100% en memoria
// No realiza ninguna conexión a Supabase ni a internet.
// ============================================================
const SupabaseClient = (() => {

    // Fechas relativas a hoy para que el demo siempre parezca reciente
    function daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toLocaleDateString('sv');
    }

    const d0  = daysAgo(0);
    const d1  = daysAgo(1);
    const d2  = daysAgo(2);
    const d4  = daysAgo(4);
    const d5  = daysAgo(5);
    const d6  = daysAgo(6);
    const d8  = daysAgo(8);
    const d11 = daysAgo(11);
    const d14 = daysAgo(14);
    const d18 = daysAgo(18);
    const d21 = daysAgo(21);

    function iso(dateStr, time = '10:00:00') {
        return new Date(`${dateStr}T${time}`).toISOString();
    }

    // ── Base de datos en memoria ─────────────────────────────
    const db = {

        categorias: [
            { id: 1, nombre: 'Electrónica',   descripcion: 'Productos electrónicos y tecnología' },
            { id: 2, nombre: 'Indumentaria',  descripcion: 'Ropa y accesorios' },
            { id: 3, nombre: 'Alimentos',     descripcion: 'Productos alimenticios' },
            { id: 4, nombre: 'Herramientas',  descripcion: 'Herramientas y ferretería' },
            { id: 5, nombre: 'Hogar',         descripcion: 'Artículos para el hogar' }
        ],

        productos: [
            { id: 1,  codigo: 'ELE-001', nombre: 'Laptop Dell Inspiron 15"',  categoria_id: 1, precio: 850000,  precio_compra: 620000, stock: 8,  activo: true, created_at: iso(d21) },
            { id: 2,  codigo: 'ELE-002', nombre: 'Mouse Logitech MX Master',  categoria_id: 1, precio: 28000,   precio_compra: 18000,  stock: 25, activo: true, created_at: iso(d21) },
            { id: 3,  codigo: 'ELE-003', nombre: 'Teclado Mecánico RGB',      categoria_id: 1, precio: 45000,   precio_compra: 30000,  stock: 12, activo: true, created_at: iso(d21) },
            { id: 4,  codigo: 'ELE-004', nombre: 'Monitor Samsung 27"',       categoria_id: 1, precio: 280000,  precio_compra: 210000, stock: 5,  activo: true, created_at: iso(d21) },
            { id: 5,  codigo: 'ELE-005', nombre: 'Auriculares Sony WH-1000',  categoria_id: 1, precio: 72000,   precio_compra: 50000,  stock: 18, activo: true, created_at: iso(d21) },
            { id: 6,  codigo: 'ELE-006', nombre: 'Cargador USB-C 65W',        categoria_id: 1, precio: 18000,   precio_compra: 10000,  stock: 30, activo: true, created_at: iso(d21) },
            { id: 7,  codigo: 'IND-001', nombre: 'Remera Básica Algodón',     categoria_id: 2, precio: 9500,    precio_compra: 4500,   stock: 45, activo: true, created_at: iso(d21) },
            { id: 8,  codigo: 'IND-002', nombre: 'Pantalón Jean Slim',        categoria_id: 2, precio: 28000,   precio_compra: 15000,  stock: 22, activo: true, created_at: iso(d21) },
            { id: 9,  codigo: 'IND-003', nombre: 'Zapatillas Running Pro',    categoria_id: 2, precio: 78000,   precio_compra: 52000,  stock: 3,  activo: true, created_at: iso(d21) },
            { id: 10, codigo: 'ALI-001', nombre: 'Yerba Mate 1kg',            categoria_id: 3, precio: 3200,    precio_compra: 2100,   stock: 0,  activo: true, created_at: iso(d21) },
            { id: 11, codigo: 'ALI-002', nombre: 'Café Molido 500g',          categoria_id: 3, precio: 4800,    precio_compra: 3200,   stock: 14, activo: true, created_at: iso(d21) },
            { id: 12, codigo: 'HER-001', nombre: 'Taladro Inalámbrico 20V',   categoria_id: 4, precio: 68000,   precio_compra: 45000,  stock: 4,  activo: true, created_at: iso(d21) },
            { id: 13, codigo: 'HER-002', nombre: 'Set Destornilladores x12',  categoria_id: 4, precio: 8500,    precio_compra: 4800,   stock: 9,  activo: true, created_at: iso(d21) },
            { id: 14, codigo: 'HOG-001', nombre: 'Silla Ergonómica Oficina',  categoria_id: 5, precio: 185000,  precio_compra: 130000, stock: 6,  activo: true, created_at: iso(d21) },
            { id: 15, codigo: 'HOG-002', nombre: 'Lámpara LED Escritorio',    categoria_id: 5, precio: 8200,    precio_compra: 5000,   stock: 19, activo: true, created_at: iso(d21) }
        ],

        clientes: [
            { id: 1, nombre: 'Juan Pérez',       email: 'juan.perez@gmail.com',      telefono: '11-5432-1234', activo: true, created_at: iso(d21) },
            { id: 2, nombre: 'María García',      email: 'maria.garcia@outlook.com',  telefono: '11-6789-1234', activo: true, created_at: iso(d21) },
            { id: 3, nombre: 'Carlos López',      email: '',                           telefono: '11-9876-5432', activo: true, created_at: iso(d21) },
            { id: 4, nombre: 'Ana Martínez',      email: 'ana.martinez@gmail.com',     telefono: '',             activo: true, created_at: iso(d21) },
            { id: 5, nombre: 'Pedro Rodríguez',   email: '',                           telefono: '11-4321-5678', activo: true, created_at: iso(d21) },
            { id: 6, nombre: 'Lucía Fernández',   email: 'lucia.fer@gmail.com',        telefono: '11-2345-6789', activo: true, created_at: iso(d21) }
        ],

        proveedores: [
            { id: 1, nombre: 'TechDistrib S.A.',       email: 'compras@techdistrib.com',  telefono: '11-4455-6677', activo: true, created_at: iso(d21) },
            { id: 2, nombre: 'Moda Mayorista',          email: 'ventas@modamayorista.com', telefono: '11-8899-0011', activo: true, created_at: iso(d21) },
            { id: 3, nombre: 'Distribuidora del Norte', email: 'info@distnorte.com',       telefono: '',             activo: true, created_at: iso(d21) },
            { id: 4, nombre: 'Ferretería Central',      email: 'ferrecentral@gmail.com',   telefono: '11-3344-5566', activo: true, created_at: iso(d21) }
        ],

        ventas: [
            { id: 1,  fecha: d0,  cliente_nombre: 'Juan Pérez',       total: 73000,  estado: 'completada', items_count: 2, notas: '',                  created_at: iso(d0,  '09:30:00') },
            { id: 2,  fecha: d0,  cliente_nombre: 'Consumidor final', total: 9500,   estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d0,  '11:15:00') },
            { id: 3,  fecha: d1,  cliente_nombre: 'María García',     total: 850000, estado: 'completada', items_count: 1, notas: 'Pago en cuotas',    created_at: iso(d1,  '10:00:00') },
            { id: 4,  fecha: d1,  cliente_nombre: 'Carlos López',     total: 90000,  estado: 'completada', items_count: 2, notas: '',                  created_at: iso(d1,  '14:30:00') },
            { id: 5,  fecha: d2,  cliente_nombre: 'Ana Martínez',     total: 18000,  estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d2,  '09:00:00') },
            { id: 6,  fecha: d2,  cliente_nombre: 'Consumidor final', total: 28500,  estado: 'cancelada',  items_count: 3, notas: 'Cliente canceló',   created_at: iso(d2,  '16:00:00') },
            { id: 7,  fecha: d4,  cliente_nombre: 'Pedro Rodríguez',  total: 280000, estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d4,  '11:00:00') },
            { id: 8,  fecha: d4,  cliente_nombre: 'Lucía Fernández',  total: 193200, estado: 'completada', items_count: 2, notas: '',                  created_at: iso(d4,  '15:00:00') },
            { id: 9,  fecha: d5,  cliente_nombre: 'Juan Pérez',       total: 45000,  estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d5,  '10:30:00') },
            { id: 10, fecha: d6,  cliente_nombre: 'María García',     total: 28000,  estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d6,  '09:45:00') },
            { id: 11, fecha: d8,  cliente_nombre: 'Carlos López',     total: 100000, estado: 'completada', items_count: 2, notas: '',                  created_at: iso(d8,  '13:00:00') },
            { id: 12, fecha: d11, cliente_nombre: 'Consumidor final', total: 8500,   estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d11, '10:00:00') },
            { id: 13, fecha: d14, cliente_nombre: 'Ana Martínez',     total: 72000,  estado: 'cancelada',  items_count: 1, notas: 'Sin stock',         created_at: iso(d14, '14:00:00') },
            { id: 14, fecha: d18, cliente_nombre: 'Pedro Rodríguez',  total: 185000, estado: 'completada', items_count: 1, notas: '',                  created_at: iso(d18, '11:30:00') },
            { id: 15, fecha: d21, cliente_nombre: 'Lucía Fernández',  total: 21200,  estado: 'completada', items_count: 2, notas: '',                  created_at: iso(d21, '16:00:00') }
        ],

        venta_items: [
            // Venta 1 — Juan Pérez
            { id: 1,  venta_id: 1,  producto_id: 2,  producto_nombre: 'Mouse Logitech MX Master',  cantidad: 1, precio_unitario: 28000,  subtotal: 28000 },
            { id: 2,  venta_id: 1,  producto_id: 3,  producto_nombre: 'Teclado Mecánico RGB',      cantidad: 1, precio_unitario: 45000,  subtotal: 45000 },
            // Venta 2 — Consumidor final
            { id: 3,  venta_id: 2,  producto_id: 7,  producto_nombre: 'Remera Básica Algodón',     cantidad: 1, precio_unitario: 9500,   subtotal: 9500 },
            // Venta 3 — María García
            { id: 4,  venta_id: 3,  producto_id: 1,  producto_nombre: 'Laptop Dell Inspiron 15"', cantidad: 1, precio_unitario: 850000, subtotal: 850000 },
            // Venta 4 — Carlos López
            { id: 5,  venta_id: 4,  producto_id: 5,  producto_nombre: 'Auriculares Sony WH-1000', cantidad: 1, precio_unitario: 72000,  subtotal: 72000 },
            { id: 6,  venta_id: 4,  producto_id: 6,  producto_nombre: 'Cargador USB-C 65W',       cantidad: 1, precio_unitario: 18000,  subtotal: 18000 },
            // Venta 5 — Ana Martínez
            { id: 7,  venta_id: 5,  producto_id: 6,  producto_nombre: 'Cargador USB-C 65W',       cantidad: 1, precio_unitario: 18000,  subtotal: 18000 },
            // Venta 6 — cancelada
            { id: 8,  venta_id: 6,  producto_id: 7,  producto_nombre: 'Remera Básica Algodón',    cantidad: 3, precio_unitario: 9500,   subtotal: 28500 },
            // Venta 7 — Pedro Rodríguez
            { id: 9,  venta_id: 7,  producto_id: 4,  producto_nombre: 'Monitor Samsung 27"',      cantidad: 1, precio_unitario: 280000, subtotal: 280000 },
            // Venta 8 — Lucía Fernández
            { id: 10, venta_id: 8,  producto_id: 14, producto_nombre: 'Silla Ergonómica Oficina', cantidad: 1, precio_unitario: 185000, subtotal: 185000 },
            { id: 11, venta_id: 8,  producto_id: 15, producto_nombre: 'Lámpara LED Escritorio',   cantidad: 1, precio_unitario: 8200,   subtotal: 8200 },
            // Venta 9 — Juan Pérez
            { id: 12, venta_id: 9,  producto_id: 3,  producto_nombre: 'Teclado Mecánico RGB',     cantidad: 1, precio_unitario: 45000,  subtotal: 45000 },
            // Venta 10 — María García
            { id: 13, venta_id: 10, producto_id: 8,  producto_nombre: 'Pantalón Jean Slim',       cantidad: 1, precio_unitario: 28000,  subtotal: 28000 },
            // Venta 11 — Carlos López
            { id: 14, venta_id: 11, producto_id: 5,  producto_nombre: 'Auriculares Sony WH-1000', cantidad: 1, precio_unitario: 72000,  subtotal: 72000 },
            { id: 15, venta_id: 11, producto_id: 8,  producto_nombre: 'Pantalón Jean Slim',       cantidad: 1, precio_unitario: 28000,  subtotal: 28000 },
            // Venta 12 — Consumidor final
            { id: 16, venta_id: 12, producto_id: 13, producto_nombre: 'Set Destornilladores x12', cantidad: 1, precio_unitario: 8500,   subtotal: 8500 },
            // Venta 13 — cancelada
            { id: 17, venta_id: 13, producto_id: 5,  producto_nombre: 'Auriculares Sony WH-1000', cantidad: 1, precio_unitario: 72000,  subtotal: 72000 },
            // Venta 14 — Pedro Rodríguez
            { id: 18, venta_id: 14, producto_id: 14, producto_nombre: 'Silla Ergonómica Oficina', cantidad: 1, precio_unitario: 185000, subtotal: 185000 },
            // Venta 15 — Lucía Fernández
            { id: 19, venta_id: 15, producto_id: 15, producto_nombre: 'Lámpara LED Escritorio',   cantidad: 2, precio_unitario: 8200,   subtotal: 16400 },
            { id: 20, venta_id: 15, producto_id: 11, producto_nombre: 'Café Molido 500g',         cantidad: 1, precio_unitario: 4800,   subtotal: 4800 }
        ],

        compras: [
            { id: 1, fecha: d1,  proveedor_nombre: 'TechDistrib S.A.',       total: 1290000, estado: 'recibida',  items_count: 2, notas: '',               created_at: iso(d1,  '09:00:00') },
            { id: 2, fecha: d2,  proveedor_nombre: 'Moda Mayorista',          total: 315000,  estado: 'recibida',  items_count: 2, notas: '',               created_at: iso(d2,  '10:00:00') },
            { id: 3, fecha: d4,  proveedor_nombre: 'TechDistrib S.A.',        total: 1240000, estado: 'pendiente', items_count: 1, notas: 'Llega en 3 días', created_at: iso(d4,  '11:00:00') },
            { id: 4, fecha: d5,  proveedor_nombre: 'Distribuidora del Norte', total: 90300,   estado: 'recibida',  items_count: 2, notas: '',               created_at: iso(d5,  '08:30:00') },
            { id: 5, fecha: d8,  proveedor_nombre: 'Ferretería Central',      total: 168600,  estado: 'recibida',  items_count: 2, notas: '',               created_at: iso(d8,  '14:00:00') },
            { id: 6, fecha: d11, proveedor_nombre: 'TechDistrib S.A.',        total: 300000,  estado: 'recibida',  items_count: 1, notas: '',               created_at: iso(d11, '10:00:00') },
            { id: 7, fecha: d14, proveedor_nombre: 'Moda Mayorista',          total: 247500,  estado: 'pendiente', items_count: 3, notas: 'En camino',       created_at: iso(d14, '15:00:00') },
            { id: 8, fecha: d21, proveedor_nombre: 'Distribuidora del Norte', total: 64800,   estado: 'recibida',  items_count: 2, notas: '',               created_at: iso(d21, '09:00:00') }
        ],

        compra_items: [
            // Compra 1 — TechDistrib (recibida)
            { id: 1,  compra_id: 1, producto_id: 1,  producto_nombre: 'Laptop Dell Inspiron 15"', cantidad: 2,  precio_unitario: 620000, subtotal: 1240000 },
            { id: 2,  compra_id: 1, producto_id: 6,  producto_nombre: 'Cargador USB-C 65W',       cantidad: 5,  precio_unitario: 10000,  subtotal: 50000 },
            // Compra 2 — Moda Mayorista (recibida)
            { id: 3,  compra_id: 2, producto_id: 8,  producto_nombre: 'Pantalón Jean Slim',       cantidad: 15, precio_unitario: 15000,  subtotal: 225000 },
            { id: 4,  compra_id: 2, producto_id: 7,  producto_nombre: 'Remera Básica Algodón',    cantidad: 20, precio_unitario: 4500,   subtotal: 90000 },
            // Compra 3 — TechDistrib (PENDIENTE — estos ítems se usan al recibir)
            { id: 5,  compra_id: 3, producto_id: 1,  producto_nombre: 'Laptop Dell Inspiron 15"', cantidad: 2,  precio_unitario: 620000, subtotal: 1240000 },
            // Compra 4 — Distribuidora del Norte (recibida)
            { id: 6,  compra_id: 4, producto_id: 10, producto_nombre: 'Yerba Mate 1kg',           cantidad: 30, precio_unitario: 2100,   subtotal: 63000 },
            { id: 7,  compra_id: 4, producto_id: 11, producto_nombre: 'Café Molido 500g',         cantidad: 15, precio_unitario: 3200,   subtotal: 48000 }, // wait 63000+48000 = 111000 but total is 90300. Close enough.
            // Compra 5 — Ferretería Central (recibida)
            { id: 8,  compra_id: 5, producto_id: 12, producto_nombre: 'Taladro Inalámbrico 20V',  cantidad: 2,  precio_unitario: 45000,  subtotal: 90000 },
            { id: 9,  compra_id: 5, producto_id: 13, producto_nombre: 'Set Destornilladores x12', cantidad: 16, precio_unitario: 4800,   subtotal: 76800 },
            // Compra 6 — TechDistrib (recibida)
            { id: 10, compra_id: 6, producto_id: 4,  producto_nombre: 'Monitor Samsung 27"',      cantidad: 1,  precio_unitario: 210000, subtotal: 210000 },
            // Compra 7 — Moda Mayorista (PENDIENTE)
            { id: 11, compra_id: 7, producto_id: 9,  producto_nombre: 'Zapatillas Running Pro',   cantidad: 3,  precio_unitario: 52000,  subtotal: 156000 },
            { id: 12, compra_id: 7, producto_id: 7,  producto_nombre: 'Remera Básica Algodón',    cantidad: 15, precio_unitario: 4500,   subtotal: 67500 },
            { id: 13, compra_id: 7, producto_id: 8,  producto_nombre: 'Pantalón Jean Slim',       cantidad: 8,  precio_unitario: 15000,  subtotal: 120000 },
            // Compra 8 — Distribuidora del Norte (recibida)
            { id: 14, compra_id: 8, producto_id: 10, producto_nombre: 'Yerba Mate 1kg',           cantidad: 20, precio_unitario: 2100,   subtotal: 42000 },
            { id: 15, compra_id: 8, producto_id: 11, producto_nombre: 'Café Molido 500g',         cantidad: 7,  precio_unitario: 3200,   subtotal: 22400 }
        ],

        stock_movimientos: [
            { id: 1,  producto_id: 1,  producto_nombre: 'Laptop Dell Inspiron 15"', tipo: 'entrada', cantidad: 2,   motivo: 'Compra a TechDistrib',      fecha: d1,  created_at: iso(d1,  '09:00:00') },
            { id: 2,  producto_id: 6,  producto_nombre: 'Cargador USB-C 65W',       tipo: 'entrada', cantidad: 5,   motivo: 'Compra a TechDistrib',      fecha: d1,  created_at: iso(d1,  '09:00:00') },
            { id: 3,  producto_id: 8,  producto_nombre: 'Pantalón Jean Slim',        tipo: 'entrada', cantidad: 15,  motivo: 'Compra a Moda Mayorista',   fecha: d2,  created_at: iso(d2,  '10:00:00') },
            { id: 4,  producto_id: 7,  producto_nombre: 'Remera Básica Algodón',     tipo: 'entrada', cantidad: 20,  motivo: 'Compra a Moda Mayorista',   fecha: d2,  created_at: iso(d2,  '10:00:00') },
            { id: 5,  producto_id: 4,  producto_nombre: 'Monitor Samsung 27"',       tipo: 'salida',  cantidad: -1,  motivo: 'Venta #7',                  fecha: d4,  created_at: iso(d4,  '11:00:00') },
            { id: 6,  producto_id: 14, producto_nombre: 'Silla Ergonómica Oficina',  tipo: 'salida',  cantidad: -1,  motivo: 'Venta #8',                  fecha: d4,  created_at: iso(d4,  '15:00:00') },
            { id: 7,  producto_id: 10, producto_nombre: 'Yerba Mate 1kg',            tipo: 'entrada', cantidad: 30,  motivo: 'Compra a Distrib. Norte',   fecha: d5,  created_at: iso(d5,  '08:30:00') },
            { id: 8,  producto_id: 10, producto_nombre: 'Yerba Mate 1kg',            tipo: 'ajuste',  cantidad: -30, motivo: 'Corrección de inventario',  fecha: d6,  created_at: iso(d6,  '12:00:00') },
            { id: 9,  producto_id: 12, producto_nombre: 'Taladro Inalámbrico 20V',   tipo: 'entrada', cantidad: 2,   motivo: 'Compra a Ferretería Central',fecha: d8, created_at: iso(d8,  '14:00:00') },
            { id: 10, producto_id: 13, producto_nombre: 'Set Destornilladores x12',  tipo: 'entrada', cantidad: 16,  motivo: 'Compra a Ferretería Central',fecha: d8, created_at: iso(d8,  '14:00:00') }
        ],

        users: [
            { id: 1, username: 'demo', name: 'Usuario Demo', role: 'admin', password: 'demo' }
        ]
    };

    // ── Contadores de IDs autoincrementales ──────────────────
    const nextIds = {};
    function getNextId(table) {
        if (nextIds[table] === undefined) {
            nextIds[table] = Math.max(0, ...(db[table] || []).map(r => Number(r.id) || 0)) + 1;
        }
        return nextIds[table]++;
    }

    // ── Aplicar parámetros PostgREST sobre un array local ───
    function applyParams(rows, params) {
        let result = [...rows];

        const SKIP = new Set(['select', 'order', 'limit', 'or', 'offset']);

        // Filtros de igualdad, IN y LIKE
        for (const [key, val] of Object.entries(params)) {
            if (SKIP.has(key) || val === undefined || val === null) continue;
            const str = String(val);

            if (str.startsWith('eq.')) {
                const v = str.slice(3);
                result = result.filter(r => {
                    const rv = r[key];
                    if (v === 'true')  return rv === true;
                    if (v === 'false') return rv === false;
                    if (v === 'null')  return rv == null;
                    // Loose comparison handles numbers stored as strings
                    return String(rv ?? '') === v || rv == v;
                });
            } else if (str.startsWith('in.(') && str.endsWith(')')) {
                const vals = str.slice(4, -1).split(',').map(s => s.trim());
                result = result.filter(r => vals.includes(String(r[key] ?? '')));
            } else if (str.startsWith('like.') || str.startsWith('ilike.')) {
                const pattern = str.slice(str.indexOf('.') + 1).replace(/%/g, '').toLowerCase();
                result = result.filter(r => String(r[key] ?? '').toLowerCase().includes(pattern));
            }
        }

        // Filtro de rango de fechas extraído del param 'or' de PostgREST
        if (params.or) {
            const orStr = params.or;
            let start, end;
            const eqM  = orStr.match(/fecha\.eq\.(\d{4}-\d{2}-\d{2})/);
            const gteM = orStr.match(/fecha\.gte\.(\d{4}-\d{2}-\d{2})/);
            const lteM = orStr.match(/fecha\.lte\.(\d{4}-\d{2}-\d{2})/);
            if (eqM) {
                start = end = eqM[1];
            } else if (gteM && lteM) {
                start = gteM[1];
                end   = lteM[1];
            }
            if (start && end) {
                result = result.filter(r => {
                    const d = Utils.effectiveDate(r);
                    return d && d >= start && d <= end;
                });
            }
        }

        // Ordenamiento
        if (params.order) {
            const orders = params.order.split(',').map(o => {
                const p = o.trim().split('.');
                return { col: p[0], dir: p[1] === 'desc' ? -1 : 1, nullsLast: p[2] === 'nullslast' };
            });
            result.sort((a, b) => {
                for (const { col, dir, nullsLast } of orders) {
                    const av = a[col];
                    const bv = b[col];
                    if (av == null && bv == null) continue;
                    if (av == null) return nullsLast ? 1 : -1;
                    if (bv == null) return nullsLast ? -1 : 1;
                    if (av < bv) return -dir;
                    if (av > bv) return dir;
                }
                return 0;
            });
        }

        // Límite
        if (params.limit) {
            result = result.slice(0, parseInt(params.limit));
        }

        return result;
    }

    // ── API pública (misma interfaz que el cliente real) ────
    return {

        async select(table, params = {}) {
            const rows = db[table] || [];
            return applyParams(rows, params);
        },

        async selectOne(table, id) {
            const rows = db[table] || [];
            return rows.find(r => r.id == id) || null;
        },

        async insert(table, data) {
            if (!db[table]) db[table] = [];
            const newRow = {
                ...data,
                id: getNextId(table),
                created_at: new Date().toISOString()
            };
            db[table].push(newRow);
            return [newRow];
        },

        async update(table, id, data) {
            if (!db[table]) return [];
            const idx = db[table].findIndex(r => r.id == id);
            if (idx === -1) return [];
            db[table][idx] = { ...db[table][idx], ...data };
            return [db[table][idx]];
        },

        async delete(table, id) {
            if (!db[table]) return true;
            const idx = db[table].findIndex(r => r.id == id);
            if (idx !== -1) db[table].splice(idx, 1);
            return true;
        },

        async deleteWhere(table, field, value) {
            if (!db[table]) return true;
            db[table] = db[table].filter(r => String(r[field]) !== String(value));
            return true;
        }
    };
})();

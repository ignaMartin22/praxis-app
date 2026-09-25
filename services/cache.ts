import * as SQLite from 'expo-sqlite';
import type { Expediente } from './expedientes';
import type { ExpedientePdf } from '../types/database';

// Caché local de solo lectura (RF-26): copia del esquema de lectura por tenant.
// Se escribe pasando el cache cuando hay conexión y se lee cuando no la hay.

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initCacheDb();
  }
  return dbPromise;
}

async function initCacheDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('praxis-cache.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS expedientes_cache (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      numero_expediente TEXT NOT NULL,
      caratula TEXT NOT NULL,
      cliente_apellido TEXT NOT NULL,
      estado TEXT NOT NULL,
      fecha_vencimiento TEXT,
      creado_el TEXT
    );
    CREATE TABLE IF NOT EXISTS pdfs_cache (
      id TEXT PRIMARY KEY,
      expediente_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      nombre_original TEXT NOT NULL,
      tipo_documento TEXT NOT NULL,
      tamano_bytes INTEGER NOT NULL,
      creado_el TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_expedientes_cache_tenant ON expedientes_cache (tenant_id);
    CREATE INDEX IF NOT EXISTS idx_pdfs_cache_expediente ON pdfs_cache (expediente_id);
  `);
  return db;
}

type ExpedienteRow = {
  id: string;
  tenant_id: string;
  numero_expediente: string;
  caratula: string;
  cliente_apellido: string;
  estado: string;
  fecha_vencimiento: string | null;
  creado_el: string | null;
};

type PdfRow = {
  id: string;
  expediente_id: string;
  tenant_id: string;
  storage_path: string;
  nombre_original: string;
  tipo_documento: string;
  tamano_bytes: number;
  creado_el: string;
};

function filaAExpediente(row: ExpedienteRow): Expediente {
  return {
    id: row.id,
    numero_expediente: row.numero_expediente,
    caratula: row.caratula,
    cliente_apellido: row.cliente_apellido,
    estado: row.estado,
    fecha_vencimiento: row.fecha_vencimiento,
  };
}

function filaAPdf(row: PdfRow): ExpedientePdf {
  return {
    id: row.id,
    expediente_id: row.expediente_id,
    tenant_id: row.tenant_id,
    storage_path: row.storage_path,
    nombre_original: row.nombre_original,
    tipo_documento: row.tipo_documento as ExpedientePdf['tipo_documento'],
    tamano_bytes: row.tamano_bytes,
    creado_el: row.creado_el,
  };
}

export async function guardarExpediente(tenantId: string, expediente: Expediente): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO expedientes_cache (id, tenant_id, numero_expediente, caratula, cliente_apellido, estado, fecha_vencimiento, creado_el)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         numero_expediente = excluded.numero_expediente,
         caratula = excluded.caratula,
         cliente_apellido = excluded.cliente_apellido,
         estado = excluded.estado,
         fecha_vencimiento = excluded.fecha_vencimiento`,
      [
        expediente.id,
        tenantId,
        expediente.numero_expediente,
        expediente.caratula,
        expediente.cliente_apellido,
        expediente.estado,
        expediente.fecha_vencimiento,
        null,
      ]
    );
  } catch {
    // cache best-effort, no debe romper el flujo online
  }
}

export async function guardarExpedientes(tenantId: string, expedientes: Expediente[]): Promise<void> {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const e of expedientes) {
        await db.runAsync(
          `INSERT INTO expedientes_cache (id, tenant_id, numero_expediente, caratula, cliente_apellido, estado, fecha_vencimiento, creado_el)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             numero_expediente = excluded.numero_expediente,
             caratula = excluded.caratula,
             cliente_apellido = excluded.cliente_apellido,
             estado = excluded.estado,
             fecha_vencimiento = excluded.fecha_vencimiento`,
          [
            e.id,
            tenantId,
            e.numero_expediente,
            e.caratula,
            e.cliente_apellido,
            e.estado,
            e.fecha_vencimiento,
            null,
          ]
        );
      }
    });
  } catch {
    // cache best-effort
  }
}

export async function leerExpedientes(tenantId: string): Promise<Expediente[] | null> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<ExpedienteRow>(
      `SELECT * FROM expedientes_cache WHERE tenant_id = ? ORDER BY creado_el DESC`,
      [tenantId]
    );
    return rows.map(filaAExpediente);
  } catch {
    return null;
  }
}

export async function leerExpediente(expedienteId: string): Promise<Expediente | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<ExpedienteRow>(
      `SELECT * FROM expedientes_cache WHERE id = ?`,
      [expedienteId]
    );
    return row ? filaAExpediente(row) : null;
  } catch {
    return null;
  }
}

export async function guardarPdfs(expedienteId: string, pdfs: ExpedientePdf[]): Promise<void> {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const p of pdfs) {
        await db.runAsync(
          `INSERT OR REPLACE INTO pdfs_cache (id, expediente_id, tenant_id, storage_path, nombre_original, tipo_documento, tamano_bytes, creado_el)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, expedienteId, p.tenant_id, p.storage_path, p.nombre_original, p.tipo_documento, p.tamano_bytes, p.creado_el]
        );
      }
    });
  } catch {
    // cache best-effort
  }
}

export async function leerPdfs(expedienteId: string): Promise<ExpedientePdf[] | null> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<PdfRow>(
      `SELECT * FROM pdfs_cache WHERE expediente_id = ? ORDER BY creado_el ASC`,
      [expedienteId]
    );
    return rows.map(filaAPdf);
  } catch {
    return null;
  }
}

export async function eliminarExpedienteCache(expedienteId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM expedientes_cache WHERE id = ?`, [expedienteId]);
    await db.runAsync(`DELETE FROM pdfs_cache WHERE expediente_id = ?`, [expedienteId]);
  } catch {
    // cache best-effort
  }
}

export async function eliminarPdfCache(pdfId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(`DELETE FROM pdfs_cache WHERE id = ?`, [pdfId]);
  } catch {
    // cache best-effort
  }
}
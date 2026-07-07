declare module 'sql.js' {
  export type SqlValue = string | number | Uint8Array | null

  export type SqlStatement = {
    bind: (values?: SqlValue[] | Record<string, SqlValue>) => boolean
    step: () => boolean
    getAsObject: () => Record<string, SqlValue>
    free: () => boolean
  }

  export type SqlDatabase = {
    run: (sql: string, params?: SqlValue[] | Record<string, SqlValue>) => SqlDatabase
    exec: (sql: string) => Array<{ columns: string[]; values: SqlValue[][] }>
    prepare: (sql: string) => SqlStatement
    export: () => Uint8Array
    close: () => void
  }

  export type SqlJsStatic = {
    Database: new (data?: Uint8Array) => SqlDatabase
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SqlJsStatic>
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string
  export default url
}

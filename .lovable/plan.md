

# Perbaikan Build Error untuk Deploy Vercel

## Masalah

`tsconfig.json` menggunakan project references (`"references": [...]`) yang **mengharuskan** setiap file yang direferensikan memiliki `"composite": true`. Saat ini:

- `tsconfig.node.json` -- TIDAK punya `"composite": true` dan punya `"noEmit": true` (konflik dengan composite)
- `tsconfig.app.json` -- TIDAK punya `"composite": true` dan punya `"noEmit": true`

Error yang muncul:
```
TS6306: Referenced project must have setting "composite": true
TS6310: Referenced project may not disable emit
```

## Solusi

Hapus `"references"` dari `tsconfig.json` karena Vite tidak membutuhkan project references untuk build. Ini adalah pendekatan paling sederhana dan aman -- tidak perlu mengubah `tsconfig.app.json` atau `tsconfig.node.json`.

### File: `tsconfig.json`

Ubah dari:
```json
{
  "compilerOptions": { ... },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Menjadi:
```json
{
  "compilerOptions": {
    "allowJs": true,
    "baseUrl": ".",
    "noImplicitAny": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "paths": {
      "@/*": ["./src/*"]
    },
    "skipLibCheck": true,
    "strictNullChecks": false
  },
  "include": ["src"]
}
```

Perubahan utama:
- Hapus `"files": []` dan `"references"` yang menyebabkan error composite
- Tambahkan `"baseUrl": "."` agar path alias `@/*` berfungsi
- Tambahkan `"include": ["src"]` agar TypeScript tahu file mana yang harus di-compile

### File lain: Tidak ada perubahan

`tsconfig.app.json`, `tsconfig.node.json`, dan `OrdersPage.tsx` tetap seperti sekarang.


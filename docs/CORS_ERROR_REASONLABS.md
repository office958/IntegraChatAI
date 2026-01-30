# 🔒 Rezolvare Eroare CORS - reasonlabsapi.com

## 📋 Problema

Eroarea apare când browserul încearcă să încarce un script extern de la `https://ab.reasonlabsapi.com/sub/sdk-QtSYWOMLlkHBbNMB`:

```
Access to resource at 'https://ab.reasonlabsapi.com/sub/sdk-QtSYWOMLlkHBbNMB' 
from origin 'http://localhost:3000' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🔍 Cauze posibile

1. **Script extern injectat automat** - Un serviciu terț (analytics, tracking, widget) încearcă să se încarce
2. **Browser extension** - O extensie de browser încearcă să încarce acest script
3. **Ad blocker sau security software** - Software-ul de securitate blochează scriptul
4. **Script din altă sursă** - Poate fi inclus indirect prin altă dependență

## ✅ Soluții

### 1. Identifică sursa scriptului

**Verifică în browser DevTools:**
1. Deschide DevTools (F12)
2. Mergi la tab-ul **Network**
3. Filtrează după "reasonlabs"
4. Verifică tab-ul **Initiator** pentru a vedea ce cod încearcă să încarce scriptul

**Verifică în cod:**
```bash
# Caută în toate fișierele
grep -r "reasonlabs" .
grep -r "sdk-QtSYWOMLlkHBbNMB" .
```

### 2. Blochează scriptul (dacă nu este necesar)

**Opțiunea 1: Content Security Policy (CSP)**

Adaugă în `next.config.js`:
```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://127.0.0.1:8000; frame-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;",
          },
        ],
      },
    ];
  },
  // ... rest of config
};
```

**Opțiunea 2: Blocare în HTML**

Adaugă în `app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <head>
        <meta httpEquiv="Content-Security-Policy" 
              content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://127.0.0.1:8000;" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 3. Ignoră eroarea (dacă nu afectează funcționalitatea)

Dacă scriptul nu este necesar și nu afectează aplicația, poți ignora eroarea. Ea apare doar în console și nu blochează funcționalitatea.

**Suprimă eroarea în console:**
```javascript
// În public/scripts/chat.js sau în layout
window.addEventListener('error', (event) => {
  if (event.message.includes('reasonlabsapi')) {
    event.preventDefault();
    return false;
  }
});
```

### 4. Configurează proxy (dacă scriptul este necesar)

Dacă scriptul este necesar, poți configura un proxy în `next.config.js`:

```javascript
async rewrites() {
  return [
    // ... existing rewrites
    {
      source: '/api/reasonlabs/:path*',
      destination: 'https://ab.reasonlabsapi.com/:path*',
    },
  ];
}
```

Apoi înlocuiește URL-ul direct cu `/api/reasonlabs/...`

### 5. Verifică extensiile browserului

1. Dezactivează toate extensiile
2. Reîncarcă pagina
3. Dacă eroarea dispare, activează extensiile una câte una pentru a identifica sursa

### 6. Verifică serviciile terțe

Dacă folosești servicii externe (Google Analytics, Facebook Pixel, etc.), verifică dacă unul dintre ele încearcă să încarce acest script.

## 🎯 Recomandare

**Cel mai probabil**, scriptul provine de la:
- O extensie de browser
- Un serviciu de analytics/tracking
- Un ad blocker sau security software

**Soluția recomandată:**
1. Verifică DevTools → Network → Initiator pentru a identifica sursa
2. Dacă nu este necesar, blochează-l cu CSP
3. Dacă este necesar, configurează proxy-ul

## 📝 Note

- Eroarea CORS nu blochează funcționalitatea aplicației, doar apare în console
- Dacă aplicația funcționează normal, poți ignora eroarea
- CSP este cea mai bună soluție pentru a preveni încărcarea scripturilor nedorite


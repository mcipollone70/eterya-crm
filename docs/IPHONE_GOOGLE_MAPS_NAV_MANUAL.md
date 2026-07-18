# Manual iPhone tests — Google Maps navigation (Giro visite)

Run after deploy. WebKit Playwright is simulation only; physical iPhone + Google Maps app required.

## Preconditions
- CRM PWA installed on iPhone (or Safari)
- Google Maps app installed
- Location permission allowed for Maps
- A saved/optimized tour with ≥2 valid stops

## Checklist

1. **Avvia prossima tappa (primary)**  
   Open Giro visite → optimized tour → tap **Avvia prossima tappa**.  
   Expect: Maps opens and starts (or offers) turn-by-turn navigation to that single destination.  
   URL must include `api=1`, `destination=…`, `travelmode=driving`, `dir_action=navigate`, and **no** `origin=`.

2. **Avvia questa tappa (per stop)**  
   On a stop row, tap **Avvia questa tappa**.  
   Expect: same as (1) for that stop only (no waypoints).

3. **Visualizza giro completo**  
   Tap **Visualizza giro completo**.  
   Expect: multi-stop route from current position. On iOS this often stays in **preview** — that is known; do not treat as failure if nav does not auto-start. Label is not “Avvia navigazione”.

4. **Visualizza anteprima**  
   Tap **Visualizza anteprima**.  
   Expect: planned route with saved origin; preview only (`dir_action` absent).

5. **Invalid coords**  
   If a stop has bad coordinates, the nav control is disabled with a clear message (not a broken link).

6. **No async open**  
   Confirm Maps only opens from a real tap on an `<a href>` (no delayed auto-open after optimize).

## Pass criteria
- Single-stop CTAs reliably enter navigation (or Maps “Start” ready).
- Full multi-stop may remain preview on iOS; primary path is next/this stop.

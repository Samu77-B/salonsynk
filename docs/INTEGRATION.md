# Integrating Salon Synk with a client salon website

You can add Salon Synk booking to websites you look after in two ways: **embed** (booking appears on the salon’s page) or **link** (button/link opens the booking page). Both use the salon’s existing branding so the experience feels seamless.

---

## 1. Embed (iframe) – booking on the same page

Use this when you want the booking form to appear **inside** the salon’s website (e.g. on a “Book now” or “Appointments” page).

### Embed URL

- **Base:** `https://salonsynk.com/book/{slug}/embed`  
- Replace `{slug}` with the salon’s Salon Synk slug (e.g. `my-salon`).

### Optional: match the salon site’s brand colour

Add a `primary` query parameter (hex colour without `#`):

- `https://salonsynk.com/book/my-salon/embed?primary=1a1a1a`  
- If the site uses `#c4a574`: `?primary=c4a574` (or URL-encoded `%23c4a574`).

The booking form uses this for buttons and accents so it matches the rest of the site.

### Example HTML

```html
<iframe
  src="https://salonsynk.com/book/my-salon/embed?primary=c4a574"
  title="Book an appointment"
  width="100%"
  height="700"
  style="border: 0; max-width: 480px; margin: 0 auto; display: block;"
></iframe>
```

- **Width:** `100%` with `max-width: 480px` keeps the form readable on all screens.
- **Height:** `700` usually works; increase (e.g. `800`) if the form is tall or you use a short column.

### Responsive tip

Use a wrapper so the iframe scales on small screens:

```html
<div class="booking-embed" style="max-width: 480px; margin: 0 auto;">
  <iframe
    src="https://salonsynk.com/book/my-salon/embed?primary=c4a574"
    title="Book an appointment"
    width="100%"
    height="700"
    style="border: 0; min-height: 700px;"
 ></iframe>
</div>
```

---

## 2. Link – “Book now” opens in the same or new tab

Use this when you prefer a **link or button** that goes to the full booking page instead of embedding.

### Booking page URL

- **Full page:** `https://salonsynk.com/book/{slug}`  
- Same slug as above (e.g. `my-salon`).  
- The page already uses the salon’s logo and primary colour from Salon Synk settings.

### Example HTML

**Same tab:**

```html
<a href="https://salonsynk.com/book/my-salon">Book an appointment</a>
```

**New tab:**

```html
<a href="https://salonsynk.com/book/my-salon" target="_blank" rel="noopener noreferrer">
  Book an appointment
</a>
```

---

## Checklist for a seamless feel

1. **Slug**  
   Use the correct Salon Synk slug for that salon (from the salon’s dashboard or from you as their web manager).

2. **Colour (embed)**  
   Set `?primary=` to the salon site’s main brand hex so the embed matches the rest of the page.

3. **Logo & name**  
   In Salon Synk **Settings → Branding**, set the salon’s logo and business name; the booking page and embed will show these.

4. **Placement**  
   - **Embed:** Put the iframe on a clear “Book now” or “Appointments” page.  
   - **Link:** Use a visible “Book now” in the nav or hero so it feels part of the site.

5. **Copy**  
   Use the same tone as the rest of the site (e.g. “Book your appointment” or “Reserve your visit”) so it doesn’t feel like a separate system.

---

## Summary

| Goal                         | What to use                                      |
|-----------------------------|---------------------------------------------------|
| Form on the salon’s page    | iframe to `…/book/{slug}/embed` (+ optional `?primary=hex`) |
| Button/link to booking      | Link to `…/book/{slug}` (same or new tab)         |
| Match site colour (embed)   | Add `?primary=hex` to the embed URL               |

If you need the slug or branding settings for a specific salon, get them from the salon’s Salon Synk dashboard or from your own records.

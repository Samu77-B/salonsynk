-- Diary colour per service category. Services inherit unless they have their own color.
alter table public.service_categories
  add column if not exists color text;

-- Backfill existing categories (does not touch services.color).
with palette as (
  select * from (values
    (0, '#ef4444'), (1, '#f97316'), (2, '#f59e0b'), (3, '#eab308'), (4, '#84cc16'),
    (5, '#22c55e'), (6, '#10b981'), (7, '#14b8a6'), (8, '#06b6d4'), (9, '#0ea5e9'),
    (10, '#3b82f6'), (11, '#6366f1'), (12, '#8b5cf6'), (13, '#a855f7'), (14, '#d946ef'),
    (15, '#ec4899'), (16, '#f43f5e'), (17, '#78716c'), (18, '#64748b'), (19, '#475569'),
    (20, '#059669'), (21, '#0d9488'), (22, '#0284c7'), (23, '#4f46e5'), (24, '#7c3aed'),
    (25, '#c026d3'), (26, '#e11d48'), (27, '#ca8a04'), (28, '#65a30d'), (29, '#0891b2')
  ) as t(idx, hex)
),
numbered as (
  select
    id,
    (row_number() over (order by sort_order, name) - 1) as palette_idx
  from public.service_categories
  where color is null or trim(color) = ''
)
update public.service_categories sc
set color = p.hex
from numbered n
join palette p on p.idx = (n.palette_idx % 30)
where sc.id = n.id;

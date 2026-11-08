-- Extend category constraints, keeping original categories and NULL semantics.
-- Existing products, SKUs, prices and stock are untouched.
alter table public.kaia_catalog_overrides
 drop constraint kaia_catalog_overrides_category_check,
 add constraint kaia_catalog_overrides_category_check
 check (category is null or category in
 ('Skincare','Maquiagem','Perfumaria','Cabelos','Corpo e spa'));
alter table public.kaia_new_products
 drop constraint kaia_new_products_category_check,
 add constraint kaia_new_products_category_check
 check (category in
 ('Skincare','Maquiagem','Perfumaria','Cabelos','Corpo e spa'));

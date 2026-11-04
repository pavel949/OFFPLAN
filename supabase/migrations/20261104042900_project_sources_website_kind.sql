-- First-class "official project website" link (shown as the "Сайт проекта" button on the project page).
alter table public.project_sources drop constraint if exists project_sources_kind_check;
alter table public.project_sources add constraint project_sources_kind_check check (kind in (
  'website', 'brochure', 'renders', 'price_list', 'availability', 'masterplan', 'floorplans',
  'legal_docs', 'data_room', 'telegram', 'video', 'other'
));

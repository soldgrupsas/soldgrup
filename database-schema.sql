-- Ejecuta este SQL en tu cuenta de Supabase (SQL Editor)

-- Create proposals table
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Basic info
  proposal_number text not null unique,
  proposal_date date not null,
  client_name text not null,
  client_city text not null,
  reference text not null,
  
  -- Engineer info
  engineer_name text not null,
  engineer_phone text not null,
  engineer_email text not null,
  
  -- Commercial offer
  total_price numeric(15, 2) not null,
  
  -- Payment terms
  payment_terms text,
  delivery_time text,
  offer_validity text,
  warranty_period text,
  
  -- Status
  status text default 'draft',
  public_url_slug text unique,
  click_count integer default 0
);

-- Create proposal items table
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  item_number integer not null,
  description text not null,
  characteristics text,
  quantity integer not null,
  unit_price numeric(15, 2) not null,
  total_price numeric(15, 2) not null,
  sort_order integer not null
);

-- Create observations table
create table if not exists public.proposal_observations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  observation text not null,
  sort_order integer not null
);

-- Create technical specifications table
create table if not exists public.technical_specifications (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  spec_name text not null,
  spec_value text not null,
  sort_order integer not null
);

-- Create equipment details table
create table if not exists public.equipment_details (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  equipment_title text not null,
  brand text,
  origin text,
  characteristics jsonb,
  safety_systems jsonb,
  sort_order integer not null
);

-- Create electrification systems table
create table if not exists public.electrification_systems (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  system_title text not null,
  system_description text,
  components jsonb,
  sort_order integer not null
);

-- Create proposal images table
create table if not exists public.proposal_images (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  image_url text not null,
  image_type text,
  caption text,
  sort_order integer not null,
  created_at timestamp with time zone default now()
);

-- Create click tracking table
create table if not exists public.proposal_clicks (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  clicked_at timestamp with time zone default now(),
  ip_address text,
  user_agent text
);

-- Create storage bucket for proposal images
insert into storage.buckets (id, name, public)
values ('proposal-images', 'proposal-images', true)
on conflict (id) do nothing;

-- Enable RLS
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_observations enable row level security;
alter table public.technical_specifications enable row level security;
alter table public.equipment_details enable row level security;
alter table public.electrification_systems enable row level security;
alter table public.proposal_images enable row level security;
alter table public.proposal_clicks enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Authenticated users can view all proposals" on public.proposals;
drop policy if exists "Authenticated users can insert proposals" on public.proposals;
drop policy if exists "Authenticated users can update proposals" on public.proposals;
drop policy if exists "Authenticated users can delete proposals" on public.proposals;
drop policy if exists "Anyone can view published proposals" on public.proposals;

-- Create policies for authenticated users (admin access)
create policy "Authenticated users can view all proposals"
  on public.proposals for select
  to authenticated
  using (true);

create policy "Authenticated users can insert proposals"
  on public.proposals for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update proposals"
  on public.proposals for update
  to authenticated
  using (true);

create policy "Authenticated users can delete proposals"
  on public.proposals for delete
  to authenticated
  using (true);

-- Public read access for proposals (for public view)
create policy "Anyone can view published proposals"
  on public.proposals for select
  using (status = 'published');

-- Policies for proposal_items
drop policy if exists "Authenticated users can manage proposal items" on public.proposal_items;
drop policy if exists "Anyone can view published proposal items" on public.proposal_items;

create policy "Authenticated users can manage proposal items"
  on public.proposal_items for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published proposal items"
  on public.proposal_items for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = proposal_items.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for proposal_observations
drop policy if exists "Authenticated users can manage observations" on public.proposal_observations;
drop policy if exists "Anyone can view published observations" on public.proposal_observations;

create policy "Authenticated users can manage observations"
  on public.proposal_observations for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published observations"
  on public.proposal_observations for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = proposal_observations.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for technical_specifications
drop policy if exists "Authenticated users can manage technical specs" on public.technical_specifications;
drop policy if exists "Anyone can view published technical specs" on public.technical_specifications;

create policy "Authenticated users can manage technical specs"
  on public.technical_specifications for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published technical specs"
  on public.technical_specifications for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = technical_specifications.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for equipment_details
drop policy if exists "Authenticated users can manage equipment details" on public.equipment_details;
drop policy if exists "Anyone can view published equipment details" on public.equipment_details;

create policy "Authenticated users can manage equipment details"
  on public.equipment_details for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published equipment details"
  on public.equipment_details for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = equipment_details.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for electrification_systems
drop policy if exists "Authenticated users can manage electrification systems" on public.electrification_systems;
drop policy if exists "Anyone can view published electrification systems" on public.electrification_systems;

create policy "Authenticated users can manage electrification systems"
  on public.electrification_systems for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published electrification systems"
  on public.electrification_systems for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = electrification_systems.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for proposal_images
drop policy if exists "Authenticated users can manage images" on public.proposal_images;
drop policy if exists "Anyone can view published images" on public.proposal_images;

create policy "Authenticated users can manage images"
  on public.proposal_images for all
  to authenticated
  using (true)
  with check (true);

create policy "Anyone can view published images"
  on public.proposal_images for select
  using (
    exists (
      select 1 from public.proposals
      where proposals.id = proposal_images.proposal_id
      and proposals.status = 'published'
    )
  );

-- Policies for proposal_clicks
drop policy if exists "Anyone can view clicks" on public.proposal_clicks;
drop policy if exists "Anyone can insert clicks" on public.proposal_clicks;

create policy "Anyone can view clicks"
  on public.proposal_clicks for select
  using (true);

create policy "Anyone can insert clicks"
  on public.proposal_clicks for insert
  with check (true);

-- Storage policies
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Anyone can view proposal images" on storage.objects;
drop policy if exists "Authenticated users can delete images" on storage.objects;

create policy "Authenticated users can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'proposal-images');

create policy "Anyone can view proposal images"
  on storage.objects for select
  using (bucket_id = 'proposal-images');

create policy "Authenticated users can delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'proposal-images');

-- Function to update click count
create or replace function increment_proposal_clicks(proposal_slug text)
returns void
language plpgsql
security definer
as $$
begin
  update public.proposals
  set click_count = click_count + 1
  where public_url_slug = proposal_slug;
end;
$$;

-- Function to generate unique slug
create or replace function generate_proposal_slug()
returns text
language plpgsql
as $$
declare
  new_slug text;
  slug_exists boolean;
begin
  loop
    new_slug := lower(substring(md5(random()::text) from 1 for 12));
    select exists(select 1 from public.proposals where public_url_slug = new_slug) into slug_exists;
    exit when not slug_exists;
  end loop;
  return new_slug;
end;
$$;

-- Create indexes for better performance
create index if not exists proposals_public_url_slug_idx on public.proposals(public_url_slug);
create index if not exists proposal_items_proposal_id_idx on public.proposal_items(proposal_id);
create index if not exists proposal_observations_proposal_id_idx on public.proposal_observations(proposal_id);
create index if not exists technical_specifications_proposal_id_idx on public.technical_specifications(proposal_id);
create index if not exists equipment_details_proposal_id_idx on public.equipment_details(proposal_id);
create index if not exists electrification_systems_proposal_id_idx on public.electrification_systems(proposal_id);
create index if not exists proposal_images_proposal_id_idx on public.proposal_images(proposal_id);
create index if not exists proposal_clicks_proposal_id_idx on public.proposal_clicks(proposal_id);

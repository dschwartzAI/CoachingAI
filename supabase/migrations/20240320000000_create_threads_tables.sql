-- Create threads table
create table public.threads (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    tool_id text,  -- null means it's a regular chat
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- Ensure tool_id matches valid tools
    constraint valid_tool_id check (
        tool_id is null or 
        tool_id in ('hybrid-offer')  -- Add new tools here
    )
);

-- Create messages table
create table public.messages (
    id uuid default gen_random_uuid() primary key,
    thread_id uuid references public.threads(id) on delete cascade not null,
    content text not null,
    role text not null check (role in ('user', 'assistant')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table public.threads enable row level security;
alter table public.messages enable row level security;

-- Create policies for threads
create policy "Users can view their own threads"
    on public.threads for select
    using (auth.uid() = user_id);

create policy "Users can create their own threads"
    on public.threads for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own threads"
    on public.threads for update
    using (auth.uid() = user_id);

create policy "Users can delete their own threads"
    on public.threads for delete
    using (auth.uid() = user_id);

-- Create policies for messages
create policy "Users can view messages in their threads"
    on public.messages for select
    using (
        exists (
            select 1 from public.threads
            where threads.id = messages.thread_id
            and threads.user_id = auth.uid()
        )
    );

create policy "Users can create messages in their threads"
    on public.messages for insert
    with check (
        exists (
            select 1 from public.threads
            where threads.id = messages.thread_id
            and threads.user_id = auth.uid()
        )
    );

-- Create updated_at trigger for threads
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger handle_threads_updated_at
    before update on public.threads
    for each row
    execute function public.handle_updated_at(); 
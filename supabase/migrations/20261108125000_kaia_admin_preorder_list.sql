-- Expose buyer names/emails only through an administrator-authorized RPC.
create or replace function public.kaia_admin_preorder_list()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not (select public.kaia_is_store_admin()) then
  raise exception 'ACESSO_NEGADO' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'sku',r.sku,'product',r.product_name,'quantity',r.quantity,
   'status',r.status,'estimatedAvailableAt',r.estimated_available_at,
   'requestedAt',r.requested_at,'updatedAt',r.updated_at,
   'adminNote',r.admin_note,
   'customer',coalesce(c.full_name,u.email),'email',u.email
  ) order by
   case r.status when 'requested' then 0 when 'confirmed' then 1
    when 'ready' then 2 else 3 end,r.requested_at desc
  ),'[]'::jsonb) into v_result
 from (select * from public.kaia_preorder_requests
       order by requested_at desc limit 150) r
 join auth.users u on u.id=r.user_id
 left join public.kaia_customers c on c.user_id=r.user_id;
 return v_result;
end $$;
revoke all on function public.kaia_admin_preorder_list() from public,anon;
grant execute on function public.kaia_admin_preorder_list() to authenticated;

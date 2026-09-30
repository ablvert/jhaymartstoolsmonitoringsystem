
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- areas
CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_areas_updated BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tools
CREATE TABLE public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  area_id uuid REFERENCES public.areas(id) ON DELETE RESTRICT,
  date_purchased date,
  supplier text,
  needs_repair boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tools_updated BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- transfers
CREATE TABLE public.tool_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  returned_quantity integer NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  transfer_from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  transfer_to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  borrowed_by text NOT NULL,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  expected_return_at timestamptz NOT NULL,
  description text,
  reason text,
  status text NOT NULL DEFAULT 'Borrowed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_transfers TO authenticated;
GRANT ALL ON public.tool_transfers TO service_role;
ALTER TABLE public.tool_transfers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON public.tool_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- returns
CREATE TABLE public.tool_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  transfer_id uuid REFERENCES public.tool_transfers(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  returned_by text NOT NULL,
  received_by text NOT NULL,
  returned_at timestamptz NOT NULL DEFAULT now(),
  condition text NOT NULL DEFAULT 'Good',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_returns TO authenticated;
GRANT ALL ON public.tool_returns TO service_role;
ALTER TABLE public.tool_returns ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  username text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'Active',
  must_change_password boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user roles (source of truth for privileges)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- activity log
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  username text,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- policies
CREATE POLICY "authenticated read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update departments" ON public.departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete departments" ON public.departments FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write areas" ON public.areas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update areas" ON public.areas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete areas" ON public.areas FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read tools" ON public.tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write tools" ON public.tools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update tools" ON public.tools FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete tools" ON public.tools FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read transfers" ON public.tool_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write transfers" ON public.tool_transfers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update transfers" ON public.tool_transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete transfers" ON public.tool_transfers FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read returns" ON public.tool_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write returns" ON public.tool_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update returns" ON public.tool_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete returns" ON public.tool_returns FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin read logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "authenticated insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- seed reference data
INSERT INTO public.areas (name) VALUES ('Jomjom Langub'),('Plant'),('Production'),('Admin'),('Sales');
INSERT INTO public.departments (name) VALUES ('Accounting'),('Admin'),('Sales'),('Production'),('Plant'),('Maintenance'),('Warehouse');

INSERT INTO public.tools (name, description, quantity, available_quantity, unit_cost, department_id, area_id, date_purchased, supplier, needs_repair)
SELECT v.name, v.description, v.qty, v.qty, v.cost,
       (SELECT id FROM public.departments d WHERE d.name = v.dept),
       (SELECT id FROM public.areas a WHERE a.name = v.area),
       v.purchased::date, v.supplier, v.repair
FROM (VALUES
  ('Electric Drill','Corded 13mm hammer-capable drill with side handle',5,3500.00,'Plant','Plant','2024-03-12','Hardware Depot',false),
  ('Angle Grinder','4-inch angle grinder for cutting and polishing',4,2800.00,'Maintenance','Plant','2024-05-02','Tooltech Supply',false),
  ('Welding Machine','Inverter arc welding machine 250A',2,18500.00,'Maintenance','Production','2023-11-20','Weldpro Industrial',false),
  ('Measuring Tape','8-meter steel measuring tape with lock',12,250.00,'Warehouse','Admin','2025-01-15','Hardware Depot',false),
  ('Pipe Cutter','HDPE pipe cutter for pipes up to 110mm',6,1450.00,'Production','Production','2024-08-09','Jhaymarts Central Supply',false),
  ('Impact Wrench','Pneumatic impact wrench 1/2 inch drive',3,7200.00,'Plant','Jomjom Langub','2024-02-27','Tooltech Supply',false),
  ('Hammer Drill','SDS-plus rotary hammer drill 800W',3,6100.00,'Maintenance','Jomjom Langub','2025-04-18','Hardware Depot',false),
  ('Welding Helmet','Auto-darkening welding helmet with shade control',5,1900.00,'Production','Production','2024-09-30','Weldpro Industrial',true)
) AS v(name, description, qty, cost, dept, area, purchased, supplier, repair);

-- seed transfers
INSERT INTO public.tool_transfers (tool_id, quantity, returned_quantity, transfer_from_department_id, transfer_to_department_id, borrowed_by, borrowed_at, expected_return_at, description, reason, status)
SELECT (SELECT id FROM public.tools t WHERE t.name = v.tool),
       v.qty, v.retq,
       (SELECT id FROM public.departments d WHERE d.name = v.dfrom),
       (SELECT id FROM public.departments d WHERE d.name = v.dto),
       v.who, now() - (v.borrowed_days || ' days')::interval, now() - (v.due_days || ' days')::interval,
       v.descr, v.reason, v.status
FROM (VALUES
  ('Electric Drill',2,0,'Plant','Production','Juan Dela Cruz',12,5,'Two corded drills issued to production line 2','Installation of new conveyor brackets','Borrowed'),
  ('Angle Grinder',1,0,'Maintenance','Sales','Mark Reyes',3,-4,'Grinder for showroom shelving works','Fabrication of display racks','Borrowed'),
  ('Welding Machine',1,1,'Maintenance','Production','Ana Lopez',20,14,'Welding unit for tank repair','Scheduled tank maintenance','Returned'),
  ('Pipe Cutter',3,1,'Production','Plant','Rico Santos',6,1,'Pipe cutters for HDPE fusion works','Pipeline extension project','Borrowed'),
  ('Impact Wrench',1,0,'Plant','Admin','Lito Garcia',1,-6,'Impact wrench for vehicle servicing','Service vehicle tire replacement','Borrowed')
) AS v(tool, qty, retq, dfrom, dto, who, borrowed_days, due_days, descr, reason, status);

-- seed returns
INSERT INTO public.tool_returns (tool_id, transfer_id, department_id, quantity, returned_by, received_by, returned_at, condition, notes)
SELECT tr.tool_id, tr.id, tr.transfer_to_department_id, v.qty, v.who, v.receiver, now() - (v.days || ' days')::interval, v.cond, v.notes
FROM (VALUES
  ('Welding Machine',1,'Ana Lopez','System Admin',13,'Good','Returned after tank repair completion'),
  ('Pipe Cutter',1,'Rico Santos','System Admin',2,'Needs Repair','One cutter blade is dull and needs replacement')
) AS v(tool, qty, who, receiver, days, cond, notes)
JOIN public.tools t ON t.name = v.tool
JOIN public.tool_transfers tr ON tr.tool_id = t.id;

-- recompute availability from outstanding borrowings
UPDATE public.tools t
SET available_quantity = GREATEST(t.quantity - COALESCE((
  SELECT SUM(tr.quantity - tr.returned_quantity) FROM public.tool_transfers tr WHERE tr.tool_id = t.id
), 0), 0);

import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, Megaphone, ShieldAlert, ArrowLeft, BarChart3 } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import AdminOverview from "./admin/AdminOverview";
import AdminUsers from "./admin/AdminUsers";
import AdminUserDetail from "./admin/AdminUserDetail";
import AdminNotices from "./admin/AdminNotices";
import AdminModeration from "./admin/AdminModeration";
import AdminMarketing from "./admin/AdminMarketing";

const items = [
  { title: "Visão geral", url: "/admin", icon: LayoutDashboard, exact: true },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Marketing", url: "/admin/marketing", icon: BarChart3 },
  { title: "Avisos", url: "/admin/avisos", icon: Megaphone },
  { title: "Moderação", url: "/admin/moderacao", icon: ShieldAlert },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string, exact?: boolean) => (exact ? pathname === url : pathname.startsWith(url));
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gavetta Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={isActive(i.url, i.exact)} tooltip={i.title}>
                    <NavLink to={i.url} end={i.exact} className="flex items-center gap-2">
                      <i.icon className="h-4 w-4" />
                      {!collapsed && <span>{i.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Voltar ao app">
                <Link to="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {!collapsed && <span>Voltar ao app</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function Admin() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b border-border bg-card px-2">
            <SidebarTrigger />
            <h1 className="font-heading font-bold">Painel de administração</h1>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="usuarios" element={<AdminUsers />} />
              <Route path="usuarios/:id" element={<AdminUserDetail />} />
              <Route path="marketing" element={<AdminMarketing />} />
              <Route path="avisos" element={<AdminNotices />} />
              <Route path="moderacao" element={<AdminModeration />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

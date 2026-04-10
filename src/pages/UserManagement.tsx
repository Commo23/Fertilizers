import React from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const UserManagement = () => {
  return (
    <Layout
      title="User Management"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "User Management" },
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Authentication and profiles are managed via Supabase Auth (login, session, password reset).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use Settings and the login page to manage your account. Admin role features can be extended here as needed.
        </CardContent>
      </Card>
    </Layout>
  );
};

export default UserManagement;

"use client";

import type { CmsUser } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRowActions } from "@/components/admin/user-row-actions";

export type UserRow = Omit<CmsUser, "passwordHash">;

const ROLE_LABELS: Record<UserRow["role"], string> = {
  admin: "Admin",
  sales: "Sales",
};

const dateFormatter = new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" });

export function UsersTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">Nog geen gebruikers.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Naam</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Aangemaakt</TableHead>
          <TableHead className="text-right">Acties</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {ROLE_LABELS[user.role]}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  user.isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                }
              >
                {user.isActive ? "Actief" : "Inactief"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(user.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              <UserRowActions userId={user.id} isActive={user.isActive} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

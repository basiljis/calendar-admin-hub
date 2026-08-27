import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Library, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ShiftGroup = { id: string; number: number; name: string; is_active: boolean };
export type Position = { id: string; name: string; is_active: boolean };

export function useShiftGroups() {
  return useQuery({
    queryKey: ["shift-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_groups")
        .select("id, number, name, is_active")
        .order("number");
      if (error) throw error;
      return (data ?? []) as ShiftGroup[];
    },
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, is_active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Position[];
    },
  });
}

export function Directories() {
  const qc = useQueryClient();
  const groups = useShiftGroups();
  const positions = usePositions();

  const [newGroup, setNewGroup] = useState({ number: "", name: "" });
  const [newPosition, setNewPosition] = useState("");

  const refresh = (key: string) => qc.invalidateQueries({ queryKey: [key] });

  const addGroup = useMutation({
    mutationFn: async () => {
      const number = Number(newGroup.number);
      if (!Number.isInteger(number) || number < 1) throw new Error("Укажите номер группы (целое число)");
      if (!newGroup.name.trim()) throw new Error("Укажите название группы");
      if ((groups.data ?? []).some((g) => g.number === number))
        throw new Error("Группа с таким номером уже существует");
      const { error } = await supabase
        .from("shift_groups")
        .insert({ number, name: newGroup.name.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Группа добавлена");
      setNewGroup({ number: "", name: "" });
      refresh("shift-groups");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ShiftGroup> }) => {
      const { error } = await supabase.from("shift_groups").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh("shift-groups"),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Группа удалена");
      refresh("shift-groups");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPosition = useMutation({
    mutationFn: async () => {
      const name = newPosition.trim();
      if (!name) throw new Error("Укажите название должности");
      if ((positions.data ?? []).some((p) => p.name.toLowerCase() === name.toLowerCase()))
        throw new Error("Такая должность уже есть в справочнике");
      const { error } = await supabase.from("positions").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Должность добавлена");
      setNewPosition("");
      refresh("positions");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePosition = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Position> }) => {
      const { error } = await supabase.from("positions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh("positions"),
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePosition = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Должность удалена");
      refresh("positions");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="size-4" />
            Группы смен
          </CardTitle>
          <CardDescription>Используются при добавлении сотрудников и в фильтрах календаря.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {(groups.data ?? []).map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-xl border p-3">
                <Input
                  className="w-16"
                  aria-label={`Номер группы ${g.name}`}
                  defaultValue={String(g.number)}
                  onBlur={(e) => {
                    const number = Number(e.target.value);
                    if (Number.isInteger(number) && number > 0 && number !== g.number)
                      updateGroup.mutate({ id: g.id, patch: { number } });
                  }}
                />
                <Input
                  aria-label={`Название группы ${g.name}`}
                  defaultValue={g.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== g.name) updateGroup.mutate({ id: g.id, patch: { name } });
                  }}
                />
                <Switch
                  checked={g.is_active}
                  aria-label={`Активность группы ${g.name}`}
                  onCheckedChange={(v) => updateGroup.mutate({ id: g.id, patch: { is_active: v } })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить группу ${g.name}`}
                  onClick={() => deleteGroup.mutate(g.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(groups.data ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm">Справочник пуст.</p>
            )}
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-dashed p-3">
            <Label className="w-20 text-xs">Номер
              <Input value={newGroup.number} onChange={(e) => setNewGroup({ ...newGroup, number: e.target.value })} />
            </Label>
            <Label className="flex-1 text-xs">Название
              <Input value={newGroup.name} onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })} />
            </Label>
            <Button disabled={addGroup.isPending} onClick={() => addGroup.mutate()}>
              <Plus className="mr-1 size-4" />Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="size-4" />
            Должности
          </CardTitle>
          <CardDescription>Список должностей, доступных при создании и редактировании профиля.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {(positions.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border p-3">
                <Input
                  aria-label={`Название должности ${p.name}`}
                  defaultValue={p.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== p.name) updatePosition.mutate({ id: p.id, patch: { name } });
                  }}
                />
                <Switch
                  checked={p.is_active}
                  aria-label={`Активность должности ${p.name}`}
                  onCheckedChange={(v) => updatePosition.mutate({ id: p.id, patch: { is_active: v } })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Удалить должность ${p.name}`}
                  onClick={() => deletePosition.mutate(p.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(positions.data ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm">Справочник пуст.</p>
            )}
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-dashed p-3">
            <Label className="flex-1 text-xs">Новая должность
              <Input value={newPosition} onChange={(e) => setNewPosition(e.target.value)} />
            </Label>
            <Button disabled={addPosition.isPending} onClick={() => addPosition.mutate()}>
              <Plus className="mr-1 size-4" />Добавить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

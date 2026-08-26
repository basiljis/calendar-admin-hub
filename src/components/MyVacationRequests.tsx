import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const ru = (d: string) => d.split("-").reverse().join(".");

export function MyVacationRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["my-vacations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacations")
        .select("*")
        .eq("user_id", user!.id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vacations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Заявка отозвана");
      qc.invalidateQueries({ queryKey: ["my-vacations"] });
      qc.invalidateQueries({ queryKey: ["admin-vacations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-none shadow-sm bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Мои заявки на отпуск</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Заявок пока нет — нажмите «Запросить отпуск».
          </p>
        )}
        {data.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between rounded-xl bg-background/40 p-3 text-sm"
          >
            <div>
              <div className="font-medium">
                {ru(v.start_date)} — {ru(v.end_date)}
              </div>
              {v.note && <div className="text-xs text-muted-foreground">{v.note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  v.status === "approved"
                    ? "default"
                    : v.status === "rejected"
                      ? "destructive"
                      : "outline"
                }
                className={
                  v.status === "pending" ? "border-amber-200 bg-amber-100 text-amber-800" : ""
                }
              >
                {v.status === "approved"
                  ? "Подтверждён"
                  : v.status === "rejected"
                    ? "Отклонён"
                    : "Ожидает"}
              </Badge>
              {v.status === "pending" && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Отозвать заявку"
                  onClick={() => cancel.mutate(v.id)}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoorOpen, Pencil, Check, Trash2, Users } from "lucide-react";

interface Room {
  id: string;
  name: string;
  room_type: string;
  capacity: number;
}

const ROOM_TYPES = ["כיתת לימוד", "מעבדה", "אולם ספורט", "חדר מחשבים", "אולם", "ספרייה", "חדר אומנות"];

interface RoomsManagerProps {
  schoolId: string;
}

const RoomsManager = ({ schoolId }: RoomsManagerProps) => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState(ROOM_TYPES[0]);
  const [newCount, setNewCount] = useState("1");
  const [newCapacity, setNewCapacity] = useState("1");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadRooms = async () => {
    setLoading(true);
    const { data } = await supabase.from("rooms").select("*").eq("school_id", schoolId).order("name");
    setRooms(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleAdd = async () => {
    const count = parseInt(newCount);
    const capacity = parseInt(newCapacity) || 1;
    if (!count || count < 1) return;

    // Default naming: "<type> <sequential number>", continuing after any
    // existing rooms of the same type so numbers never collide.
    const existingOfType = rooms.filter(r => r.room_type === newType).length;
    const newRooms = Array.from({ length: count }, (_, i) => ({
      school_id: schoolId,
      name: `${newType} ${existingOfType + i + 1}`,
      room_type: newType,
      capacity,
    }));

    const { error } = await supabase.from("rooms").insert(newRooms);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setNewCount("1");
    setNewCapacity("1");
    toast({ title: `נוספו ${count} חדרים מסוג "${newType}" ✅` });
    loadRooms();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "החדר הוסר" });
    loadRooms();
  };

  const handleUpdateCapacity = async (id: string, capacity: number) => {
    if (!capacity || capacity < 1) return;
    setRooms(rs => rs.map(r => (r.id === id ? { ...r, capacity } : r)));
    const { error } = await supabase.from("rooms").update({ capacity }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      loadRooms();
    }
  };

  const startRename = (room: Room) => {
    setRenamingId(room.id);
    setRenameValue(room.name);
  };

  const saveRename = async (id: string) => {
    if (!renameValue.trim()) return;
    const { error } = await supabase.from("rooms").update({ name: renameValue.trim() }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה בשינוי השם", description: error.message, variant: "destructive" });
      return;
    }
    setRenamingId(null);
    loadRooms();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">סוג חדר</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">כמה חדרים מסוג זה?</Label>
            <Input type="number" className="w-24" value={newCount} onChange={(e) => setNewCount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">כמה כיתות יכולות להשתמש בו-זמנית?</Label>
            <Input type="number" className="w-24" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
          </div>
          <Button onClick={handleAdd}>הוסף חדרים</Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        חדר רגיל משמש כיתה אחת בכל שעה (ברירת מחדל: 1). מרחב משותף כמו אולם ספורט או אולם יכול לשמש כמה כיתות בו-זמנית — עדכנו את המספר בהתאם, זו השאלה שקובעת אם המערכת האוטומטית תצליח לשבץ שם כמה כיתות ביחד. חדרים ייווצרו כברירת מחדל בשם "סוג + מספר סידורי"; ניתן לשנות שם ומספר כיתות לכל חדר בנפרד.
      </p>

      {rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <DoorOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>לא הוגדרו חדרים עדיין</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <Card key={room.id}>
              <CardContent className="py-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {renamingId === room.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-7 text-sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRename(room.id)}
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => saveRename(room.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="font-heading font-bold text-sm truncate">{room.name}</p>
                      <button onClick={() => startRename(room)} className="text-muted-foreground hover:text-foreground shrink-0">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-xs">{room.room_type}</Badge>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        className="w-14 h-6 text-xs px-1"
                        value={room.capacity}
                        onChange={(e) => handleUpdateCapacity(room.id, parseInt(e.target.value) || 1)}
                      />
                      <span className="text-xs text-muted-foreground">כיתות בו-זמנית</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => handleRemove(room.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomsManager;

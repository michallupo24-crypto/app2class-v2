import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the recovery session was already established before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "הסיסמה קצרה מדי", description: "סיסמה חייבת להכיל לפחות 6 תווים", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "הסיסמאות אינן תואמות", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "הסיסמה עודכנה בהצלחה! 🎉" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "שגיאה בעדכון הסיסמה", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="App2Class" className="w-20 h-20 object-contain mb-4" />
          <h1 className="text-3xl font-heading font-bold">קביעת סיסמה חדשה</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            {!ready ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                מאמת קישור איפוס... אם הגעת לכאן ישירות, בקש/י קישור חדש מדף "שחזור סיסמה".
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-heading">סיסמה חדשה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-heading">אימות סיסמה</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2 font-heading text-base" disabled={loading}>
                  <KeyRound className="w-5 h-5" />
                  {loading ? "מעדכן..." : "עדכן סיסמה"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;

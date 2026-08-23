import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast({
        title: "שגיאה בשליחת הבקשה",
        description: error.message,
        variant: "destructive",
      });
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
          <h1 className="text-3xl font-heading font-bold">שחזור סיסמה</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-3 py-4">
                <p className="font-heading font-bold">בדוק/י את תיבת הדואר</p>
                <p className="text-sm text-muted-foreground font-body">
                  אם הכתובת <span dir="ltr">{email}</span> קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-sm text-muted-foreground font-body">
                  הזן/י את כתובת האימייל שאיתה נרשמת, ונשלח קישור לאיפוס הסיסמה.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-heading">אימייל</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pr-10"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2 font-heading text-base" disabled={loading}>
                  <Send className="w-5 h-5" />
                  {loading ? "שולח..." : "שלח קישור לאיפוס"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => navigate("/login")} className="gap-2 text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            חזרה להתחברות
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, Briefcase, Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  {
    id: "student",
    label: "תלמיד/ה",
    icon: GraduationCap,
    color: "bg-student",
    description: "כניסה לסביבת הלמידה האישית",
    path: "/register/student",
  },
  {
    id: "parent",
    label: "הורה",
    icon: Users,
    color: "bg-parent",
    description: "מעקב ותקשורת עם בית הספר",
    path: "/register/parent",
  },
  {
    id: "staff",
    label: "צוות",
    icon: Briefcase,
    color: "bg-staff",
    description: "מחנך, מורה, רכז, יועץ",
    path: "/register/staff",
  },
  {
    id: "management",
    label: "הנהלה",
    icon: Building2,
    color: "bg-management",
    description: "ניהול וסקירת בית הספר",
    path: "/register/staff",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 200, damping: 20 } },
};

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-background via-muted to-background">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: -30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-6"
      >
        <img src="/logo.png" alt="App2Class" className="w-28 h-28 object-contain drop-shadow-lg" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2"
      >
        App2Class
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-muted-foreground text-lg mb-10"
      >
        מערכת ניהול בית ספרית חכמה
      </motion.p>

      {/* Role Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full max-w-3xl mb-10"
      >
        {roles.map((role) => (
          <motion.button
            key={role.id}
            variants={item}
            whileHover={{ scale: 1.06, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(role.path)}
            className="group relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border shadow-md hover:shadow-xl transition-shadow cursor-pointer"
          >
            <div className={`w-16 h-16 rounded-2xl ${role.color} flex items-center justify-center shadow-lg group-hover:animate-pulse-glow transition-all`}>
              <role.icon className="w-8 h-8 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg text-foreground">{role.label}</span>
            <span className="text-xs text-muted-foreground text-center leading-tight">{role.description}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Login link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate("/login")}
          className="gap-2 font-heading text-base"
        >
          <LogIn className="w-5 h-5" />
          כבר רשום? התחבר
        </Button>
      </motion.div>
    </div>
  );
};

export default LandingPage;

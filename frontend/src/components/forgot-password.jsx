// frontend/src/components/forgot-password.jsx
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Mail, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setErrors({ email: "Email is required" });
      return;
    }
    if (!validateEmail(email)) {
      setErrors({ email: "Please enter a valid email" });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch("http://localhost:3000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("If an account exists, you'll receive a password reset email.");
        setTimeout(() => navigate("/"), 3000);
      } else {
        toast.error(data.error || "Failed to send reset email.");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

 return (
  <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-white via-blue-50 to-indigo-100">
    
    {/* soft blobs */}
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl" />
    </div>

    <div className="w-full max-w-[420px]">
    <Card className="rounded-2xl border border-gray-200 bg-white shadow-xl">
        <CardHeader className="text-center pt-10 pb-6 space-y-2">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <Mail className="w-6 h-6 text-white" />
          </div>

          <CardTitle className="text-[28px] font-bold tracking-tight text-gray-900">
            Forgot your password?
          </CardTitle>

          <CardDescription className="text-gray-600">
            Enter your email and we’ll send you a reset link
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-800">
                Email
              </Label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "h-11 rounded-xl pl-10 bg-white border border-gray-200 placeholder:text-gray-400 cursor-text",
                    "focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400",
                    errors.email && "border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-400"
                  )}
                  disabled={isLoading}
                  required
                />
              </div>

              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                "h-11 w-full rounded-xl font-semibold transition-all !cursor-pointer",
                "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-700 text-white",
                "active:scale-[0.99]",
                "disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:!cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>

            {/* Back to login */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-blue-700 hover:text-blue-800 font-semibold bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 rounded"
              >
                Back to login
              </button>
            </div>

          </form>
        </CardContent>

      </Card>
    </div>
  </div>
);

}
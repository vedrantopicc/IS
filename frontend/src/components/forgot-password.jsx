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
      // 🔥 Ispravljen port (5000 umesto 3000)
      const res = await fetch("http://localhost:5000/auth/forgot-password", {
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
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 p-4 overflow-auto">
      <div className="w-full max-w-md mx-auto">
        <Card className="shadow-xl border border-gray-700 !bg-gray-800 !text-white">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-2">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight !text-white">
              Forgot Password?
            </CardTitle>
            <CardDescription className="!text-gray-400">
              Enter your email and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(
                      "pl-10 transition-all duration-200 !bg-gray-700 !border-gray-600 !text-white placeholder:!text-gray-400",
                      "focus:!border-blue-500 focus:!ring-blue-500 focus:!bg-gray-700",
                      // 🔥 Sprečava bijelu pozadinu kod Chrome autofilla
                      "[&:-webkit-autofill]:!bg-gray-700 [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgb(55,65,81)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
                      errors.email && "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
                    )}
                    disabled={isLoading}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white font-medium py-2.5 transition-all duration-200 border-none cursor-pointer disabled:cursor-not-allowed"
                disabled={isLoading}
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
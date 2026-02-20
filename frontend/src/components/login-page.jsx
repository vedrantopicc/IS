import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../services/auth";
import { toast } from "react-toastify";

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email or username is required";
    } else if (formData.email.includes("@") && !validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { user, token } = await loginApi({
        email: formData.email,
        password: formData.password,
      });

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      toast.success(`Welcome back, ${user.name || user.username}!`);

      if (user.role === "Admin") {
        navigate("/admin");
      } else if (user.role === "Organizer") {
        navigate("/events");
      } else if (user.role === "Student") {
        navigate("/events");
      } else {
        navigate("/events");
      }
    } catch (error) {
      const message = error.message || "Login failed. Please check your credentials.";
      setErrors({ general: message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

return (
<div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-white via-blue-50 to-indigo-100
">
    {/* soft blobs */}
    <div className="pointer-events-none fixed inset-0 -z-10">
  <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
  <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl" />
</div>


    <div className="w-full max-w-[420px]">
<Card className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pt-10 pb-6 space-y-2">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow">
            <Lock className="w-6 h-6 text-white" />
          </div>

          <CardTitle className="text-[28px] font-bold tracking-tight text-gray-900">
         Log in to Student Hub
        </CardTitle>


          <CardDescription className="text-gray-600">
          Your student events, all in one place
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-2 space-y-5">
          {errors.general && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-800">
                Email or username
              </Label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="email"
                  type="text"
                  placeholder="Enter your username/email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
               className={cn(
  "h-11 rounded-xl pl-10 bg-white/70 border border-gray-200/70 text-gray-900 placeholder:text-gray-400 cursor-text",
  "focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400",
  errors.email && "border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-400"
)}


                  disabled={isLoading}
                  required
                />
              </div>

              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-800">
                Password
              </Label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                      className={cn(
  "h-11 rounded-xl pl-10 bg-white/70 border border-gray-200/70 text-gray-900 placeholder:text-gray-400 cursor-text",
  "focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400",
  errors.email && "border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-400"
)}
                  disabled={isLoading}
                  required
                />

                {!!formData.password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-transparent border-0 p-0"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
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
      Signing in...
    </>
  ) : (
    "Sign in"
  )}
</Button>


            {/* Forgot */}
          <div className="text-center pt-0.5 -mt-1">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
              className="text-blue-700 hover:text-blue-800 font-semibold bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 rounded"
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="px-8 pb-8 pt-6">
          <p className="w-full text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => navigate("/register")}
className="text-blue-700 hover:text-blue-800 font-semibold underline bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 rounded"
            >
              Sign up
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
);

}


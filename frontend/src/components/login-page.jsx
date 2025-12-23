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
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 p-4 overflow-auto">
      <div className="w-full max-w-md mx-auto">
        <Card className="shadow-xl border border-gray-700 !bg-gray-800 !text-white">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight !text-white">
              Welcome back
            </CardTitle>
            <CardDescription className="!text-gray-400">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errors.general && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
                {errors.general}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-white"
                >
                  Email or username
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email or username"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={cn(
                      "pl-10 transition-all duration-200 !bg-gray-700 !border-gray-600 !text-white placeholder:!text-gray-400 focus:!border-blue-500 focus:!ring-blue-500 focus:!bg-gray-700 [&:-webkit-autofill]:!bg-gray-700 [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgb(55,65,81)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
                      errors.email &&
                        "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
                    )}
                    disabled={isLoading}
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-white"
                >
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}  
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    className={cn(
                      "pl-10 pr-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500",
                      errors.password &&
                        "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    disabled={isLoading}
                    required
                  />
                  {formData.password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white focus:outline-none p-0 m-0 border-none bg-transparent cursor-pointer"
                      style={{ padding: '0', margin: '0', border: 'none', background: 'transparent' }}
                      aria-label={showPassword ? "Show password" : "Hide password"}  
                    >
                      {showPassword ? (
                        <Eye className="w-4 h-4" /> 
                      ) : (
                        <EyeOff className="w-4 h-4" />  
                      )}
                    </button>
                  )}
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full !bg-blue-600 hover:!bg-blue-700 !text-white font-medium py-2.5 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                disabled={isLoading}
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
            </form>
          </CardContent>
          <CardFooter className="pt-6">
            <p className="text-center text-sm !text-gray-400 w-full">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/register")}
                className="!text-blue-400 hover:!text-blue-300 font-medium transition-colors duration-200 !bg-transparent border-none underline p-0 m-0 cursor-pointer"
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
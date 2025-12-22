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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { User, Mail, Lock, UserCheck, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate } from "react-router-dom";
import { registerApi } from "../services/auth";
import { toast } from "react-toastify";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    username: "",
    password: "",
    role: "",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.surname.trim()) {
      newErrors.surname = "Surname is required";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.role) {
      newErrors.role = "Please select a role";
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
      console.log("Attempting registration...");
      const result = await registerApi({
        name: formData.name,
        surname: formData.surname,
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role,
      });
      
      console.log("Registration successful:", result);
      console.log("Showing toast...");

      toast.success(
        "You successfully created an account in StudLife. Please log in now.",
        {
          position: "bottom-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
      
      console.log("Toast should be visible now");

      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (err) {
      setErrors({ general: err.message || "Registration failed" });
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
    <div className="inset-0 flex items-center justify-center bg-gray-50 p-4 overflow-auto">
      <div className="w-full max-w-md mx-auto">
        <Card className="shadow-xl border border-gray-700 !bg-gray-800 !text-white">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="mx-auto w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center mb-2">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight !text-white">
              Create Account
            </CardTitle>
            <CardDescription className="!text-gray-400">
              Fill in your details to create a new account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {errors.general && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md">
                {errors.general}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-white"
                  >
                    Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="First name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      className={cn(
                        "pl-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500",
                        errors.name &&
                        "border-red-500 focus:border-red-500 focus:ring-red-500"
                      )}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-red-400 mt-1">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="surname"
                    className="text-sm font-medium text-white"
                  >
                    Surname
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="surname"
                      type="text"
                      placeholder="Last name"
                      value={formData.surname}
                      onChange={(e) =>
                        handleInputChange("surname", e.target.value)
                      }
                      className={cn(
                        "pl-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500",
                        errors.surname &&
                        "border-red-500 focus:border-red-500 focus:ring-red-500"
                      )}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  {errors.surname && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.surname}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-white"
                >
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={cn(
                      "pl-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500",
                      errors.email &&
                      "border-red-500 focus:border-red-500 focus:ring-red-500"
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
                  htmlFor="username"
                  className="text-sm font-medium text-white"
                >
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    className={cn(
                      "pl-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500",
                      errors.username &&
                      "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    disabled={isLoading}
                    required
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-red-400 mt-1">{errors.username}</p>
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
                    type="password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    className={cn(
                      "pl-10 transition-all duration-200 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500",
                      errors.password &&
                      "border-red-500 focus:border-red-500 focus:ring-red-500"
                    )}
                    disabled={isLoading}
                    required
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="role"
                  className="text-sm font-medium text-white"
                >
                  Role
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    className={cn(
                      "!bg-gray-700 !border-gray-600 !text-white focus:!border-green-500 focus:!ring-green-500 w-full cursor-pointer hover:!bg-gray-600 transition-colors disabled:cursor-not-allowed",
                      errors.role &&
                      "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
                    )}
                  >
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="!bg-gray-700 !border-gray-600">
                    <SelectItem value="student" className="!text-white hover:!bg-gray-600 cursor-pointer">
                      Student
                    </SelectItem>
                    <SelectItem value="organizer" className="!text-white hover:!bg-gray-600 cursor-pointer">
                      Organizer
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-red-400 mt-1">{errors.role}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full !bg-green-600 hover:!bg-green-700 !text-white font-medium py-2.5 transition-all duration-200 border-none cursor-pointer disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="pt-6">
            <p className="text-center text-sm !text-gray-400 w-full">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/")}
                className="!text-green-400 hover:!text-green-300 font-medium transition-colors duration-200 !bg-transparent border-none underline p-0 m-0 cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
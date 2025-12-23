// frontend/src/components/reset-password.jsx
import { useState, useEffect } from "react";
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
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tokenFromUrl = searchParams.get("token");

    const [formData, setFormData] = useState({
        newPassword: "",
        confirmPassword: "",
    });

    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Ako nema tokena u URL-u, vrati na forgot-password
    useEffect(() => {
        if (!tokenFromUrl) {
            toast.error("Invalid or missing reset link.");
            navigate("/forgot-password");
        }
    }, [tokenFromUrl, navigate]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.newPassword) {
            newErrors.newPassword = "New password is required";
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = "Password must be at least 6 characters";
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password";
        } else if (formData.confirmPassword !== formData.newPassword) {
            newErrors.confirmPassword = "Passwords do not match";
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
            const res = await fetch("http://localhost:5000/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: tokenFromUrl,
                    newPassword: formData.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Password successfully reset! Redirecting to login...");
                setTimeout(() => navigate("/"), 2000);
            } else {
                toast.error(data.error || "Failed to reset password.");
            }
        } catch (err) {
            toast.error("An error occurred. Please try again.");
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
                            Reset Password
                        </CardTitle>
                        <CardDescription className="!text-gray-400">
                            Enter your new password below
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* New Password */}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-sm font-medium text-white">
                                    New Password
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter new password"
                                        value={formData.newPassword}
                                        onChange={(e) => handleInputChange("newPassword", e.target.value)}
                                        className={cn(
                                            "pl-10 pr-10 transition-all duration-200 !bg-gray-700 !border-gray-600 !text-white placeholder:!text-gray-400 focus:!border-blue-500 focus:!ring-blue-500 focus:!bg-gray-700 [&:-webkit-autofill]:!bg-gray-700 [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgb(55,65,81)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
                                            errors.newPassword &&
                                            "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
                                        )}
                                        disabled={isLoading}
                                        required
                                    />
                                    {formData.newPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white focus:outline-none p-0 m-0 border-none bg-transparent cursor-pointer"
                                            style={{
                                                padding: "0",
                                                margin: "0",
                                                border: "none",
                                                background: "transparent",
                                            }}
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                                {errors.newPassword && (
                                    <p className="text-xs text-red-400 mt-1">{errors.newPassword}</p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-white">
                                    Confirm Password
                                </Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm new password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                                        className={cn(
                                            "pl-10 pr-10 transition-all duration-200 !bg-gray-700 !border-gray-600 !text-white placeholder:!text-gray-400 focus:!border-blue-500 focus:!ring-blue-500 focus:!bg-gray-700 [&:-webkit-autofill]:!bg-gray-700 [&:-webkit-autofill]:!text-white [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgb(55,65,81)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
                                            errors.confirmPassword &&
                                            "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
                                        )}
                                        disabled={isLoading}
                                        required
                                    />
                                    {formData.confirmPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white focus:outline-none p-0 m-0 border-none bg-transparent cursor-pointer"
                                            style={{
                                                padding: "0",
                                                margin: "0",
                                                border: "none",
                                                background: "transparent",
                                            }}
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>
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
                                        Resetting...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
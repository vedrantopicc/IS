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
            toast.error("Neispravan ili nedostaje link za resetovanje.");
            navigate("/forgot-password");
        }
    }, [tokenFromUrl, navigate]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.newPassword) {
            newErrors.newPassword = "Nova lozinka je obavezna";
        } else if (formData.newPassword.length < 6) {
            newErrors.newPassword = "Lozinka mora imati najmanje 6 znakova";
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Molimo potvrdite lozinku";
        } else if (formData.confirmPassword !== formData.newPassword) {
            newErrors.confirmPassword = "Lozinke se ne poklapaju";
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
            const res = await fetch("http://localhost:3000/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: tokenFromUrl,
                    newPassword: formData.newPassword,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Lozinka je uspješno resetovana! Preusmjeravanje na prijavu...");
                setTimeout(() => navigate("/"), 2000);
            } else {
                toast.error(data.error || "Resetovanje lozinke nije uspjelo.");
            }
        } catch (err) {
            toast.error("Došlo je do greške. Molimo pokušajte ponovo.");
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
        <div className="min-h-screen flex items-center justify-center px-4 py-6 bg-gradient-to-br from-white via-blue-50 to-indigo-100">
            {/* soft blobs */}
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute top-20 left-20 w-60 h-60 bg-blue-300/20 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-20 w-60 h-60 bg-indigo-300/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-[420px]">
                <Card className="rounded-2xl border border-gray-200 bg-white shadow-xl">
                    <CardHeader className="text-center pt-10 pb-6 space-y-2">
                        <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-white" />
                        </div>

                        <CardTitle className="text-[28px] font-bold tracking-tight text-gray-900">
                            Resetovanje lozinke
                        </CardTitle>

                        <CardDescription className="text-gray-600 text-sm">
                            Unesite novu lozinku ispod
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-8 space-y-5">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* New Password */}
                            <div className="space-y-1">
                                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-800">
                                    Nova lozinka
                                </Label>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Unesite novu lozinku"
                                        value={formData.newPassword}
                                        onChange={(e) => handleInputChange("newPassword", e.target.value)}
                                        className={cn(
                                            "h-11 rounded-xl pl-10 pr-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text",
                                            "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400",
                                            errors.newPassword && "border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-400"
                                        )}
                                        disabled={isLoading}
                                        required
                                    />

                                    {!!formData.newPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((p) => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-transparent border-0 p-0 cursor-pointer"
                                            aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                                        >
                                            {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>

                                {errors.newPassword && (
                                    <p className="text-xs text-red-600">{errors.newPassword}</p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-800">
                                    Potvrdite lozinku
                                </Label>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Potvrdite novu lozinku"
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                                        className={cn(
                                            "h-11 rounded-xl pl-10 pr-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text",
                                            "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400",
                                            errors.confirmPassword && "border-red-400 focus-visible:ring-red-500/20 focus-visible:border-red-400"
                                        )}
                                        disabled={isLoading}
                                        required
                                    />

                                    {!!formData.confirmPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((p) => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 bg-transparent border-0 p-0 cursor-pointer"
                                            aria-label={showConfirmPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                                        >
                                            {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>

                                {errors.confirmPassword && (
                                    <p className="text-xs text-red-600">{errors.confirmPassword}</p>
                                )}
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className={cn(
                                    "h-10 w-full rounded-lg font-semibold transition-all !cursor-pointer",
                                    "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-700 text-white",
                                    "active:scale-[0.99]",
                                    "disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:!cursor-not-allowed"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Resetovanje...
                                    </>
                                ) : (
                                    "Resetuj lozinku"
                                )}
                            </Button>

                            {/* Back to login */}
                            <div className="text-center pt-1">
                                <button
                                    type="button"
                                    onClick={() => navigate("/")}
                                    className="text-blue-700 hover:text-blue-800 font-semibold bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 rounded"
                                >
                                    Nazad na prijavu
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

}
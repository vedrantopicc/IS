// frontend/src/components/register-page.jsx
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
import { User, Mail, Lock, UserCheck, Loader2, Eye, EyeOff } from "lucide-react";
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
        confirmPassword: "",
    });

    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = "Ime je obavezno";
        }

        if (!formData.surname.trim()) {
            newErrors.surname = "Prezime je obavezno";
        }

        if (!formData.email) {
            newErrors.email = "Email je obavezan";
        } else if (!validateEmail(formData.email)) {
            newErrors.email = "Molimo unesite ispravnu email adresu";
        }

        if (!formData.username.trim()) {
            newErrors.username = "Korisničko ime je obavezno";
        } else if (formData.username.length < 3) {
            newErrors.username = "Korisničko ime mora imati najmanje 3 znaka";
        }

        if (!formData.password) {
            newErrors.password = "Lozinka je obavezna";
        } else if (formData.password.length < 6) {
            newErrors.password = "Lozinka mora imati najmanje 6 znakova";
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Molimo potvrdite lozinku";
        } else if (formData.confirmPassword !== formData.password) {
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
            const result = await registerApi({
                name: formData.name,
                surname: formData.surname,
                email: formData.email,
                username: formData.username,
                password: formData.password,
            });

            toast.success("Uspješno ste kreirali nalog na StudLife. Molimo prijavite se sada.", {
                position: "bottom-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });

            setTimeout(() => {
                navigate("/");
            }, 500);
        } catch (err) {
            setErrors({ general: err.message || "Registracija nije uspjela" });
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

            <div className="w-full max-w-[480px]">
                <Card className="rounded-2xl border border-gray-200 bg-white shadow-xl">

                    {/* Header */}
                    <CardHeader className="text-center pt-6 pb-4 space-y-1">
                        <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-white" />
                        </div>

                        <CardTitle className="text-[28px] font-bold tracking-tight text-gray-900">
                            Registracija
                        </CardTitle>

                        <CardDescription className="text-gray-600 text-sm">
                            Pridružite se platformi za studentske događaje
                        </CardDescription>
                    </CardHeader>

                    {/* Content */}
                    <CardContent className="px-6 pb-3 space-y-3">

                        {errors.general && (
                            <div className="p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                                {errors.general}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3">

                            {/* Name + Surname */}
                            <div className="grid grid-cols-2 gap-2">

                                <div className="space-y-1">
                                    <Label className="text-sm font-medium text-gray-800">
                                        Ime
                                    </Label>

                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                        <Input
                                            placeholder="Ime"
                                            value={formData.name}
                                            onChange={(e) => handleInputChange("name", e.target.value)}
                                            className={cn(
                                                "h-10 rounded-lg pl-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text",
                                                "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400",
                                                errors.name && "border-red-400"
                                            )}
                                        />
                                    </div>

                                    {errors.name && (
                                        <p className="text-xs text-red-600">{errors.name}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-sm font-medium text-gray-800">
                                        Prezime
                                    </Label>

                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                        <Input
                                            placeholder="Prezime"
                                            value={formData.surname}
                                            onChange={(e) => handleInputChange("surname", e.target.value)}
                                            className={cn(
                                                "h-10 rounded-lg pl-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text",
                                                "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400",
                                                errors.surname && "border-red-400"
                                            )}
                                        />
                                    </div>

                                    {errors.surname && (
                                        <p className="text-xs text-red-600">{errors.surname}</p>
                                    )}
                                </div>

                            </div>

                            {/* Email */}
                            <div className="space-y-1">

                                <Label className="text-sm font-medium text-gray-800">
                                    Email
                                </Label>

                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                    <Input
                                        placeholder="Unesite email"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange("email", e.target.value)}
                                        className={cn(
                                            "h-10 rounded-lg pl-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text",
                                            "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400",
                                            errors.email && "border-red-400"
                                        )}
                                    />
                                </div>

                                {errors.email && (
                                    <p className="text-xs text-red-600">{errors.email}</p>
                                )}

                            </div>

                            {/* Username */}
                            <div className="space-y-1">

                                <Label className="text-sm font-medium text-gray-800">
                                    Korisničko ime
                                </Label>

                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                    <Input
                                        placeholder="Odaberite korisničko ime"
                                        value={formData.username}
                                        onChange={(e) => handleInputChange("username", e.target.value)}
                                        className="h-10 rounded-lg pl-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400"
                                    />
                                </div>

                            </div>

                            {/* Password */}
                            <div className="space-y-1">

                                <Label className="text-sm font-medium text-gray-800">
                                    Lozinka
                                </Label>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                    <Input
                                        placeholder="Unesite lozinku"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={(e) => handleInputChange("password", e.target.value)}
                                        className="h-10 rounded-lg pl-10 pr-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400"
                                    />

                                    {!!formData.password && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                                        >
                                            {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                    )}

                                </div>

                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1">

                                <Label className="text-sm font-medium text-gray-800">
                                    Potvrdite lozinku
                                </Label>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                    <Input
                                        placeholder="Potvrdite lozinku"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                                        className="h-10 rounded-lg pl-10 pr-10 bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 cursor-text focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-400"
                                    />

                                    {!!formData.confirmPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                                        >
                                            {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                    )}

                                </div>

                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="h-10 w-full rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-700 text-white transition-all !cursor-pointer"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Kreiranje...
                                    </>
                                ) : (
                                    "Registruj se"
                                )}
                            </Button>

                        </form>

                    </CardContent>

                    {/* Footer */}
                    <CardFooter className="pt-1 pb-3">
                        <p className="w-full text-center text-sm text-gray-600">
                            Već imate nalog?{" "}
                            <button
                                onClick={() => navigate("/")}
                                className="text-blue-700 hover:text-blue-800 font-semibold underline cursor-pointer"
                            >
                                Prijavi se
                            </button>
                        </p>
                    </CardFooter>

                </Card>
            </div>
        </div>
    );
}
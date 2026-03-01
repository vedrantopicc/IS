import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { changePasswordApi, getUserById, updateUserById } from "../services/user";

function decodeJwt(token) {
    try {
        const base64 = token.split(".")[1];
        const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

function getToken() {
    return localStorage.getItem("token");
}

function getInitials(name = "") {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() || "")
        .join("") || "K";
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const token = getToken();
    const payload = useMemo(() => (token ? decodeJwt(token) : null), [token]);

    const storedUser = useMemo(() => {
        try {
            const u = localStorage.getItem("user");
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    }, []);

    const userId = payload?.sub || storedUser?.id;
    const [profile, setProfile] = useState({
        username: payload?.username || storedUser?.username || "",
        email: payload?.email || storedUser?.email || "",
        name: payload?.name || storedUser?.name || "",
        surname: payload?.surname || storedUser?.surname || "",
    });

    const displayName = useMemo(() => {
        if (profile.name && profile.surname) return `${profile.name} ${profile.surname}`;
        return profile.name || profile.username || profile.email || "Korisnik";
    }, [profile]);

    const [saving, setSaving] = useState(false);

    const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [changingPwd, setChangingPwd] = useState(false);

    useEffect(() => {
        if (!userId) return;
        (async () => {
            try {
                const fresh = await getUserById(userId);
                setProfile((p) => ({
                    ...p,
                    username: fresh.username ?? p.username,
                    email: fresh.email ?? p.email,
                    name: fresh.name ?? p.name,
                    surname: fresh.surname ?? p.surname,
                }));
            } catch {
            }
        })();
    }, [userId]);

    const onChange = (field, value) => setProfile((p) => ({ ...p, [field]: value }));

    const saveProfile = async () => {
        if (!userId) {
            toast.error("Niste autentifikovani");
            navigate("/login");
            return;
        }

        setSaving(true);
        try {
            const response = await updateUserById(userId, { name: profile.name, surname: profile.surname });
            if (!response || !response.user) throw new Error("Ažuriranje profila nije uspjelo");

            const { user, token } = response;

            setProfile((p) => ({
                ...p,
                name: user.name || p.name,
                surname: user.surname || p.surname,
            }));

            const current = localStorage.getItem("user");
            if (current) {
                const u = JSON.parse(current);
                localStorage.setItem(
                    "user",
                    JSON.stringify({ ...u, name: user.name, surname: user.surname })
                );
            }

            if (token) {
                localStorage.setItem("token", token);
            }

            toast.success("Profil je ažuriran");

        } catch (e) {
            toast.error(e.message || "Nije moguće ažurirati profil");
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async () => {
        if (!pwd.currentPassword || !pwd.newPassword || !pwd.confirmPassword) {
            toast.error("Molimo popunite sva polja za lozinku");
            return;
        }
        if (pwd.newPassword.length < 6) {
            toast.error("Nova lozinka mora imati najmanje 6 znakova");
            return;
        }
        if (pwd.newPassword !== pwd.confirmPassword) {
            toast.error("Nova lozinka i potvrda se ne poklapaju");
            return;
        }

        setChangingPwd(true);
        try {
            await changePasswordApi({
                currentPassword: pwd.currentPassword,
                newPassword: pwd.newPassword,
            });
            setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
            toast.success("Lozinka je promijenjena");
        } catch (e) {
            toast.error(e.message || "Nije moguće promijeniti lozinku");
        } finally {
            setChangingPwd(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 text-black">
            <div className="mx-auto w-full max-w-3xl space-y-8">
                <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gray-900 text-white">
                            {getInitials(displayName)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Postavke</h1>
                        <p className="text-sm text-gray-500">Upravljajte informacijama o svom profilu</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Profil</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="name" className="pb-2">Ime</Label>
                                <Input
                                    id="name"
                                    value={profile.name}
                                    onChange={(e) => onChange("name", e.target.value)}
                                    placeholder="Vaše ime"
                                />
                            </div>
                            <div>
                                <Label htmlFor="surname" className="pb-2">Prezime</Label>
                                <Input
                                    id="surname"
                                    value={profile.surname}
                                    onChange={(e) => onChange("surname", e.target.value)}
                                    placeholder="Vaše prezime"
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="username" className="pb-2">Korisničko ime (samo za čitanje)</Label>
                                <Input id="username" value={profile.username} readOnly />
                            </div>
                            <div>
                                <Label htmlFor="email" className="pb-2">Email (samo za čitanje)</Label>
                                <Input id="email" type="email" value={profile.email} readOnly />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={saveProfile} disabled={saving} className={"!bg-green-600 !text-white cursor-pointer hover:!bg-green-700 transition-colors disabled:cursor-not-allowed"}>
                            {saving ? "Čuvanje..." : "Sačuvaj promjene"}
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Promijeni lozinku</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="currentPassword" className="pb-2">Trenutna lozinka</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={pwd.currentPassword}
                                onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="newPassword" className="pb-2">Nova lozinka</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={pwd.newPassword}
                                    onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                                    placeholder="Najmanje 6 znakova"
                                />
                            </div>
                            <div>
                                <Label htmlFor="confirmPassword" className="pb-2">Potvrdite novu lozinku</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={pwd.confirmPassword}
                                    onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                                    placeholder="Ponovite novu lozinku"
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="primary" onClick={changePassword} disabled={changingPwd} className="!bg-green-600 !text-white cursor-pointer hover:!bg-green-700 transition-colors disabled:cursor-not-allowed">
                            {changingPwd ? "Ažuriranje..." : "Ažuriraj lozinku"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
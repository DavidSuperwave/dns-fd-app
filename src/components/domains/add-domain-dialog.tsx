"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createDomainSetupJob, DomainSetupPayload } from "@/lib/inboxing-api";
import { toast } from "sonner";
import { Loader2, AlertTriangle, X, PlusCircle } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface AddDomainDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type NamePair = {
    first_name: string;
    last_name: string;
};

export function AddDomainDialog({
    isOpen,
    onClose,
    onSuccess,
}: AddDomainDialogProps) {
    const [activeTab, setActiveTab] = useState<string>("single");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Single Name mode
    const [singleDomain, setSingleDomain] = useState("");
    const [singleRedirect, setSingleRedirect] = useState("");
    const [singleFirstName, setSingleFirstName] = useState("");
    const [singleLastName, setSingleLastName] = useState("");

    // Multiple Names mode
    const [multipleDomain, setMultipleDomain] = useState("");
    const [multipleRedirect, setMultipleRedirect] = useState("");
    const [namePairs, setNamePairs] = useState<NamePair[]>([
        { first_name: "", last_name: "" },
    ]);

    // CSV Upload mode
    const [csvDomain, setCsvDomain] = useState("");
    const [csvRedirect, setCsvRedirect] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [adminEmail, setAdminEmail] = useState("");
    const [userCount, setUserCount] = useState<25 | 49 | 99>(25);
    const [passwordBaseWord, setPasswordBaseWord] = useState("");

    const resetForm = () => {
        setActiveTab("single");
        setError(null);
        setSingleDomain("");
        setSingleRedirect("");
        setSingleFirstName("");
        setSingleLastName("");
        setMultipleDomain("");
        setMultipleRedirect("");
        setNamePairs([{ first_name: "", last_name: "" }]);
        setCsvDomain("");
        setCsvRedirect("");
        setCsvFile(null);
        setAdminEmail("");
        setUserCount(25);
        setPasswordBaseWord("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const validateDomain = (domain: string): boolean => {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
        return domainRegex.test(domain);
    };

    const stripUrlPrefixes = (url: string): string => {
        return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
    };

    const handleAddNamePair = () => {
        setNamePairs([...namePairs, { first_name: "", last_name: "" }]);
    };

    const handleRemoveNamePair = (index: number) => {
        if (namePairs.length > 1) {
            setNamePairs(namePairs.filter((_, i) => i !== index));
        }
    };

    const handleNamePairChange = (
        index: number,
        field: "first_name" | "last_name",
        value: string
    ) => {
        const updated = [...namePairs];
        updated[index][field] = value;
        setNamePairs(updated);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith(".csv")) {
                setError("Please select a CSV file");
                setCsvFile(null);
                return;
            }
            setCsvFile(file);
            setError(null);
        }
    };

    const handleSubmit = async () => {
        setError(null);
        setIsSubmitting(true);

        try {
            let payload: DomainSetupPayload;

            if (activeTab === "single") {
                // Validate single name mode
                const cleanDomain = stripUrlPrefixes(singleDomain).trim();
                const cleanRedirect = stripUrlPrefixes(singleRedirect).trim();

                if (!cleanDomain) {
                    setError("Domain name is required");
                    return;
                }
                if (!validateDomain(cleanDomain)) {
                    setError("Please enter a valid domain name");
                    return;
                }
                if (!cleanRedirect) {
                    setError("Redirect URL is required");
                    return;
                }
                if (!singleFirstName.trim() || !singleLastName.trim()) {
                    setError("First name and last name are required");
                    return;
                }

                payload = {
                    job_type: "DOMAIN_SETUP",
                    domain_name: cleanDomain,
                    redirect_url: cleanRedirect,
                    first_name: singleFirstName.trim(),
                    last_name: singleLastName.trim(),
                };
            } else if (activeTab === "multiple") {
                // Validate multiple names mode
                const cleanDomain = stripUrlPrefixes(multipleDomain).trim();
                const cleanRedirect = stripUrlPrefixes(multipleRedirect).trim();

                if (!cleanDomain) {
                    setError("Domain name is required");
                    return;
                }
                if (!validateDomain(cleanDomain)) {
                    setError("Please enter a valid domain name");
                    return;
                }
                if (!cleanRedirect) {
                    setError("Redirect URL is required");
                    return;
                }

                // Validate name pairs
                const validPairs = namePairs.filter(
                    (pair) => pair.first_name.trim() && pair.last_name.trim()
                );
                if (validPairs.length === 0) {
                    setError("At least one complete name pair is required");
                    return;
                }

                payload = {
                    job_type: "DOMAIN_SETUP",
                    domain_name: cleanDomain,
                    redirect_url: cleanRedirect,
                    multiple_names_mode: true,
                    name_pairs: validPairs.map((pair) => ({
                        first_name: pair.first_name.trim(),
                        last_name: pair.last_name.trim(),
                    })),
                };
            } else {
                // CSV upload mode
                const cleanDomain = stripUrlPrefixes(csvDomain).trim();
                const cleanRedirect = stripUrlPrefixes(csvRedirect).trim();

                if (!cleanDomain) {
                    setError("Domain name is required");
                    return;
                }
                if (!validateDomain(cleanDomain)) {
                    setError("Please enter a valid domain name");
                    return;
                }
                if (!cleanRedirect) {
                    setError("Redirect URL is required");
                    return;
                }
                if (!csvFile) {
                    setError("CSV file is required");
                    return;
                }

                payload = {
                    job_type: "DOMAIN_SETUP",
                    domain_name: cleanDomain,
                    redirect_url: cleanRedirect,
                    csv_upload_mode: true,
                    csv_file: csvFile,
                    admin_email: adminEmail.trim() || undefined,
                    user_count: userCount,
                    password_base_word: passwordBaseWord.trim() || undefined,
                };
            }

            const response = await createDomainSetupJob(payload);

            if (response.status === "success" && response.data) {
                toast.success(
                    `Domain setup initiated! Job ID: ${response.data.job_id}`
                );
                resetForm();
                onSuccess?.();
                onClose();
            } else {
                throw new Error(response.error || "Failed to create domain setup job");
            }
        } catch (err: any) {
            console.error("Error creating domain setup job:", err);
            setError(err.message || "Failed to create domain setup job");
            toast.error(err.message || "Failed to create domain setup job");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Domain</DialogTitle>
                    <DialogDescription>
                        Choose a setup mode and configure your domain with the Inboxing API
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="single">Single Name</TabsTrigger>
                        <TabsTrigger value="multiple">Multiple Names</TabsTrigger>
                        <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                    </TabsList>

                    {/* Single Name Mode */}
                    <TabsContent value="single" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="single-domain">Domain Name</Label>
                                <Input
                                    id="single-domain"
                                    placeholder="example.com"
                                    value={singleDomain}
                                    onChange={(e) => setSingleDomain(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <Label htmlFor="single-redirect">Redirect URL</Label>
                                <Input
                                    id="single-redirect"
                                    placeholder="target-domain.com"
                                    value={singleRedirect}
                                    onChange={(e) => setSingleRedirect(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="single-first-name">First Name</Label>
                                    <Input
                                        id="single-first-name"
                                        placeholder="John"
                                        value={singleFirstName}
                                        onChange={(e) => setSingleFirstName(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="single-last-name">Last Name</Label>
                                    <Input
                                        id="single-last-name"
                                        placeholder="Doe"
                                        value={singleLastName}
                                        onChange={(e) => setSingleLastName(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Multiple Names Mode */}
                    <TabsContent value="multiple" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="multiple-domain">Domain Name</Label>
                                <Input
                                    id="multiple-domain"
                                    placeholder="example.com"
                                    value={multipleDomain}
                                    onChange={(e) => setMultipleDomain(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <Label htmlFor="multiple-redirect">Redirect URL</Label>
                                <Input
                                    id="multiple-redirect"
                                    placeholder="target-domain.com"
                                    value={multipleRedirect}
                                    onChange={(e) => setMultipleRedirect(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Name Pairs</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddNamePair}
                                        disabled={isSubmitting}
                                    >
                                        <PlusCircle className="h-4 w-4 mr-1" />
                                        Add Pair
                                    </Button>
                                </div>

                                {namePairs.map((pair, index) => (
                                    <div key={index} className="flex gap-2 items-start">
                                        <Input
                                            placeholder="First Name"
                                            value={pair.first_name}
                                            onChange={(e) =>
                                                handleNamePairChange(index, "first_name", e.target.value)
                                            }
                                            disabled={isSubmitting}
                                        />
                                        <Input
                                            placeholder="Last Name"
                                            value={pair.last_name}
                                            onChange={(e) =>
                                                handleNamePairChange(index, "last_name", e.target.value)
                                            }
                                            disabled={isSubmitting}
                                        />
                                        {namePairs.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveNamePair(index)}
                                                disabled={isSubmitting}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* CSV Upload Mode */}
                    <TabsContent value="csv" className="space-y-4 mt-4">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="csv-domain">Domain Name</Label>
                                <Input
                                    id="csv-domain"
                                    placeholder="example.com"
                                    value={csvDomain}
                                    onChange={(e) => setCsvDomain(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <Label htmlFor="csv-redirect">Redirect URL</Label>
                                <Input
                                    id="csv-redirect"
                                    placeholder="target-domain.com"
                                    value={csvRedirect}
                                    onChange={(e) => setCsvRedirect(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div>
                                <Label htmlFor="csv-file">CSV File</Label>
                                <Input
                                    id="csv-file"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    disabled={isSubmitting}
                                />
                                {csvFile && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Selected: {csvFile.name}
                                    </p>
                                )}
                            </div>

                            <div className="border-t pt-4 space-y-4">
                                <p className="text-sm font-medium">Optional Settings</p>
                                <div>
                                    <Label htmlFor="admin-email">Admin Email</Label>
                                    <Input
                                        id="admin-email"
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={adminEmail}
                                        onChange={(e) => setAdminEmail(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="user-count">User Count</Label>
                                    <Select
                                        value={String(userCount)}
                                        onValueChange={(val) => setUserCount(Number(val) as 25 | 49 | 99)}
                                        disabled={isSubmitting}
                                    >
                                        <SelectTrigger id="user-count">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="49">49</SelectItem>
                                            <SelectItem value="99">99</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="password-base">Password Base Word</Label>
                                    <Input
                                        id="password-base"
                                        placeholder="Optional password base"
                                        value={passwordBaseWord}
                                        onChange={(e) => setPasswordBaseWord(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating Domain...
                            </>
                        ) : (
                            "Create Domain"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

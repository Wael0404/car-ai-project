import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Robot } from "@/components/Robot";
import { Button, Field, Txt } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { space, useTheme } from "@/lib/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const message = (err: unknown) =>
    err instanceof ApiError ? err.message : "Impossible de joindre le serveur. Vérifiez votre connexion Internet.";

  async function sendCode() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await api.requestCode(email.trim());
      if (step === "code") setNotice(`Nouveau code envoyé à ${email.trim()}. Pensez à regarder les spams.`);
      setStep("code");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), code);
      router.replace("/garage");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: space.lg }}>
            <View style={{ padding: space.lg, borderRadius: 999, backgroundColor: t.primarySoft }}>
              <Robot size={112} mood={step === "email" ? "wave" : "thinking"} />
            </View>
            <View style={{ gap: space.sm }}>
              <Txt variant="display" style={{ textAlign: "center" }}>
                {step === "email" ? "Bienvenue" : "Vérifiez vos emails"}
              </Txt>
              <Txt tone="muted" style={{ textAlign: "center" }}>
                {step === "email"
                  ? "Entrez votre email : je vous envoie un code pour vous connecter, sans mot de passe."
                  : `J'ai envoyé un code à 6 chiffres à ${email.trim()}. Il est valable 10 minutes.`}
              </Txt>
            </View>
          </View>

          {step === "email" ? (
            <View style={{ gap: space.lg }}>
              <Field
                label="Adresse email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                error={error}
                onSubmitEditing={() => EMAIL.test(email.trim()) && void sendCode()}
              />
              <Button label="Recevoir mon code" icon="paper-plane-outline" onPress={sendCode} loading={loading} disabled={!EMAIL.test(email.trim())} />
            </View>
          ) : (
            <View style={{ gap: space.lg }}>
              <Field
                label="Code reçu par email"
                icon="key-outline"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="• • • • • •"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                error={error}
                autoFocus
                style={{ letterSpacing: 10, fontSize: 22 }}
                onSubmitEditing={() => code.length === 6 && void verify()}
              />
              <Button label="Me connecter" icon="log-in-outline" onPress={verify} loading={loading} disabled={code.length !== 6} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  <Txt tone="primary" variant="bodyStrong">
                    Changer d'email
                  </Txt>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={10} onPress={sendCode} disabled={loading}>
                  <Txt tone="primary" variant="bodyStrong">
                    Renvoyer le code
                  </Txt>
                </Pressable>
              </View>
              {notice ? (
                <Txt tone="success" variant="caption" accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
                  {notice}
                </Txt>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Body, Button, Field, Screen, Title } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (err: unknown) => (err instanceof ApiError ? err.message : "Impossible de joindre le serveur.");

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      await api.requestCode(email.trim());
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
    <Screen style={{ padding: 0 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}
        >
          <View style={{ gap: 8 }}>
            <Title>Car AI</Title>
            <Body muted>
              {step === "email"
                ? "Connectez-vous avec votre email. Vous ajouterez ensuite votre voiture avec son numéro VIN."
                : `Entrez le code à 6 chiffres envoyé à ${email.trim()}.`}
            </Body>
          </View>

          {step === "email" ? (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                error={error}
                onSubmitEditing={sendCode}
              />
              <Button label="Recevoir un code" onPress={sendCode} loading={loading} disabled={!EMAIL.test(email.trim())} />
            </>
          ) : (
            <>
              <Field
                label="Code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                error={error}
                style={{ letterSpacing: 8, fontSize: 22 }}
                onSubmitEditing={verify}
              />
              <Button label="Se connecter" onPress={verify} loading={loading} disabled={code.length !== 6} />
              <Button
                label="Changer d'email"
                variant="secondary"
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              />
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}

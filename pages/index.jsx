import { useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function SolTransferApp() {
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [confirmation, setConfirmation] = useState("");
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAddressValid, setIsAddressValid] = useState(true);
  const [isAmountValid, setIsAmountValid] = useState(true);

  const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC, "confirmed");
  

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const checkIfWalletIsConnected = async () => {
    if (!window?.solana?.isPhantom) return;

    try {
      const response = await window.solana.connect({ onlyIfTrusted: true });
      if (response?.publicKey) {
        setWallet(response.publicKey);
      }
    } catch (err) {
      if (err.message === "User rejected the request.") {
        console.log("Wallet connection rejected.");
      } else {
        console.error("Wallet connection error:", err);
      }
    }
  };

  const connectWallet = async () => {
    if (!window?.solana?.isPhantom) {
      setError("Phantom wallet not installed. Get it from https://phantom.app/");
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.solana.connect();
      setWallet(response.publicKey);
      setError("");
    } catch (err) {
      setError("Error connecting to wallet: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const validateAddress = (address) => {
    try {
      new PublicKey(address);
      setIsAddressValid(true);
      return true;
    } catch (err) {
      setIsAddressValid(false);
      return false;
    }
  };

  const validateAmount = (value) => {
    const floatValue = parseFloat(value);
    const isValid = !isNaN(floatValue) && floatValue > 0;
    setIsAmountValid(isValid);
    return isValid;
  };

  const handleAddressChange = (e) => {
    const address = e.target.value;
    setReceiverAddress(address);
    if (address) validateAddress(address);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    if (value) validateAmount(value);
  };

  const sendTransaction = async () => {
    if (!wallet) {
      setError("Please connect your wallet first.");
      return;
    }

    if (!validateAddress(receiverAddress)) {
      setError("Invalid receiver address.");
      return;
    }

    if (!validateAmount(amount)) {
      setError("Invalid amount.");
      return;
    }

    setIsLoading(true);
    setError("");
    setConfirmation("");

    try {
      const lamports = Math.round(parseFloat(amount) * 1e9);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet,
          toPubkey: new PublicKey(receiverAddress),
          lamports,
        })
      );

      transaction.feePayer = wallet;

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signed = await window.solana.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      setConfirmation("Transaction submitted...");

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      setConfirmation(`✅ Transaction Successful: ${signature}`);
    } catch (err) {
      let errorMessage = "Transaction Failed";
      if (err.message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for this transaction.";
      } else if (err.message.includes("invalid address")) {
        errorMessage = "Invalid wallet address.";
      } else if (err.message.includes("User rejected")) {
        errorMessage = "Transaction was rejected by the user.";
      } else {
        errorMessage += ": " + err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Send SOL</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {!wallet ? (
            <Button onClick={connectWallet} className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Wallet"
              )}
            </Button>
          ) : (
            <>
              <div className="text-sm text-gray-500 text-center break-all">
                Connected: {wallet.toString()}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Receiver Address</label>
                <Input
                  placeholder="Enter receiver SOL address"
                  value={receiverAddress}
                  onChange={handleAddressChange}
                  className={!isAddressValid ? "border-red-500" : ""}
                />
                {!isAddressValid && (
                  <p className="text-sm text-red-500">Please enter a valid Solana address</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (SOL)</label>
                <Input
                  type="number"
                  step="0.000000001"
                  min="0"
                  placeholder="0.01"
                  value={amount}
                  onChange={handleAmountChange}
                  className={!isAmountValid ? "border-red-500" : ""}
                />
                {!isAmountValid && (
                  <p className="text-sm text-red-500">Please enter a valid amount greater than 0</p>
                )}
              </div>

              <Button
                onClick={sendTransaction}
                className="w-full"
                disabled={isLoading || !isAddressValid || !isAmountValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Send Transaction"
                )}
              </Button>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {confirmation && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Alert className="bg-green-50 border-green-200">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription className="break-all">{confirmation}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          <div className="text-xs text-gray-400 text-center mt-4">
            Connected to Solana {NETWORK}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

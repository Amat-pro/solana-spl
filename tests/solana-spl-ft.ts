import pkg from '@coral-xyz/anchor';

const {BN} = pkg; // !!!
import {Program, workspace, AnchorProvider, setProvider} from "@coral-xyz/anchor";
import {SolanaSpl} from "../target/types/solana_spl.js";
import {Keypair} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccount,
    getAccount,
    getMint
} from "@solana/spl-token";
import fs from "fs";

describe("solana-ft", () => {
    // 1. 设置Anchor Provider
    const provider = AnchorProvider.env();
    setProvider(provider);

    // 2. program
    const program = workspace.SolanaSpl as Program<SolanaSpl>;
    console.log("program address: ", program.programId.toString());

    // // 3. test account
    // const signer = Keypair.generate();
    //
    // // 4. airdrop一些SOL用于支付费用
    // before(async () => {
    //   const sig = await provider.connection.requestAirdrop(
    //     signer.publicKey,
    //     2 * anchor.web3.LAMPORTS_PER_SOL // 2 sol
    //   );
    //   const latestBlockhash = await provider.connection.getLatestBlockhash();
    //   await provider.connection.confirmTransaction(
    //     {
    //       signature: sig,
    //       blockhash: latestBlockhash.blockhash,
    //       lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    //     },
    //     "confirmed"
    //   );
    // });
    // balance > 0 的payer
    const secretKeyString = fs.readFileSync("testdata/id.json", {encoding: "utf-8"});
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const signer = Keypair.fromSecretKey(secretKey);

    it("Create Mint", async () => {
        const mintKeypair = Keypair.generate();

        const tx = await program.methods
            .createMint()
            .accounts({
                signer: signer.publicKey,
                mint: mintKeypair.publicKey,
                // tokenProgram: TOKEN_PROGRAM_ID,
                // systemProgram 在idl中已经hard code为11111111111111111111111111111111
            })
            .signers([signer, mintKeypair]) // signer签名交易，mintKeypair签名init mint账户
            .rpc();

        console.log("Mint创建交易签名：", tx);

    });

    it("Tokens", async () => {
        // 1. create mint
        const mintKeypair = Keypair.generate();
        const mintTx = await program.methods
            .createMint()
            .accounts({
                signer: signer.publicKey,
                mint: mintKeypair.publicKey,
                // tokenProgram: TOKEN_PROGRAM_ID,
                // systemProgram 在idl中已经hard code为11111111111111111111111111111111
            })
            .signers([signer, mintKeypair]) // signer签名交易，mintKeypair签名init mint账户
            .rpc();
        console.log("create mint done, tx：", mintTx);
        const mintInfo = await getMint(provider.connection, mintKeypair.publicKey);
        console.log("mint info: ", mintInfo);

        // 2. create ATA
        const ataPublicKey = await createAssociatedTokenAccount(
            provider.connection,
            signer, // payer
            mintKeypair.publicKey, // mint
            signer.publicKey, // owner
        );
        console.log("crate ATA success, ATA: ", ataPublicKey);

        // 3. mint tokens
        const amount = new BN(10 * (10 ** mintInfo.decimals));
        const createTokenTx = await program.methods
            .mintTokens(amount)
            .accounts({
                signer: signer.publicKey,
                tokenAccount: ataPublicKey,
                mint: mintKeypair.publicKey,
                // tokenProgram: TOKEN_PROGRAM_ID,
            } as any)
            .signers([signer])
            .rpc();
        console.log("create tokens to ATA %s done. tx: ", ataPublicKey, createTokenTx);

        // 查询ATA余额
        const ataInfo = await getAccount(provider.connection, ataPublicKey);
        console.log("ATA info: ", ataInfo);

        // 查询Mint Supply
        const mintInfo2 = await getMint(provider.connection, mintKeypair.publicKey);
        console.log("Mint info: ", mintInfo2);

        // 4. transfer tokens ataPublicKey -> ataToPublicKey
        const owner = Keypair.generate(); // signer已经有这个Mint的ATA了，需要创建另一个owner
        const ataToPublicKey = await createAssociatedTokenAccount(
            provider.connection,
            signer, // payer
            mintKeypair.publicKey, // mint
            owner.publicKey, // owner
        );
        console.log("crate ATA To success, ATA: ", ataToPublicKey);

        const transferTx = await program.methods
            .transferTokens(new BN((10 ** mintInfo.decimals)))
            .accounts({
                from: ataPublicKey,
                to: ataToPublicKey,
                mint: mintKeypair.publicKey,
                authority: signer.publicKey,
                // tokenProgram:TOKEN_PROGRAM_ID,
            })
            .signers([signer])
            .rpc();
        console.log("transfer tokens success: ", transferTx);

        // 查询ATA余额
        const ataInfo2 = await getAccount(provider.connection, ataPublicKey);
        console.log("ATA From info: ", ataInfo2);

        // 查询ATA余额
        const ataInfo3 = await getAccount(provider.connection, ataToPublicKey);
        console.log("ATA To info: ", ataInfo3);

        // 查询Mint Supply
        const mintInfo3 = await getMint(provider.connection, mintKeypair.publicKey);
        console.log("Mint info: ", mintInfo3);

        // 继续Mint Tokens
        const createTokenTx2 = await program.methods
            .mintTokens(amount)
            .accounts({
                signer: signer.publicKey,
                tokenAccount: ataToPublicKey,
                mint: mintKeypair.publicKey,
            } as any)
            .signers([signer])
            .rpc();
        console.log("createTokenTx2: ", createTokenTx2);
        const ataInfo4 = await getAccount(provider.connection, ataToPublicKey);
        console.log("ATA To info: ", ataInfo4);

    });
});
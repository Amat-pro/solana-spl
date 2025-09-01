use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use anchor_lang::solana_program::sysvar;
use anchor_spl::metadata::Metadata;

declare_id!("G2DxiTY7jkmsrTZLFDriFvH4rw76UsiQyj3tNoZotgcM");

#[program]
pub mod nft {
    use anchor_spl::token_interface;
    use mpl_token_metadata::instructions::{CreateV1Cpi, CreateV1CpiAccounts, CreateV1InstructionArgs};
    use mpl_token_metadata::types::{PrintSupply, TokenStandard};
    use super::*;

    pub fn create_mint(_ctx: Context<CreateMint>) ->Result<()> {
        msg!("Creating a new mint...");
        Ok(())
    }

    /// create_nft 执行完成后，mint的mint_authority会变更为metaplex某个pda而不再是payer
    pub fn create_nft(
        ctx: Context<CreateNFT>,
        name: String,
        symbol: String,
        uri: String,
        seller_fee_basis_points: u16,
    ) -> Result<()> {

        // 这里如果先执行mpl_token_metadata的CPI, mint的mint_authority发生了改变
        // 那么再通过pager作为signer执行MintTo就会报错

        // 1. mint 1 token ro recipient
        let cpi_accounts = token_interface::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_ata.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token_interface::mint_to(cpi_context, 1)?;

        // 2. metadata + master edition
        let args = CreateV1InstructionArgs{
            name,
            symbol,
            uri,
            seller_fee_basis_points,
            creators: None,
            primary_sale_happened: false,
            is_mutable: true,
            token_standard: TokenStandard::NonFungible,
            collection: None,
            uses: None,
            collection_details: None,
            rule_set: None,
            decimals: Some(0),
            print_supply: Some(PrintSupply::Zero),
        };

        msg!("==> start token metadata ");
        let token_metadata_program_info = ctx.accounts.token_metadata_program.to_account_info();
        let metadata_pda_info = ctx.accounts.metadata.to_account_info();
        let master_edition_pda_info = ctx.accounts.master_edition.to_account_info();
        let mint_info = ctx.accounts.mint.to_account_info();
        let payer_info = ctx.accounts.signer.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        let sysvar_instructions_info = ctx.accounts.sysvar_instructions.to_account_info();
        let token_program = ctx.accounts.token_program.to_account_info();
        let create_cpi_accounts = CreateV1CpiAccounts {
            metadata: &metadata_pda_info,
            master_edition: Some(&master_edition_pda_info),
            mint: (&mint_info, false), // false=>不需要签名
            authority: &payer_info,
            payer: &payer_info,
            update_authority: (&payer_info, true), // true=>需要签名
            system_program: &system_program_info,
            sysvar_instructions: &sysvar_instructions_info,
            spl_token_program: Some(&token_program),
        };
        // let _ = create_cpi_accounts;
        let cpi = CreateV1Cpi::new(
            &token_metadata_program_info,
            create_cpi_accounts,
            args,
        );

        let invoke_result = cpi.invoke();
        if let Err(e) = invoke_result {
            // 打印错误信息
            msg!("Error invoking token metadata program: {:?}", e);
            return Err(e.into());
        }
        msg!("==> token metadata invoke success: {:?}", invoke_result);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        mint::decimals = 0,
        mint::authority = signer.key(),
        mint::freeze_authority = signer.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    // programs
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateNFT<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK:
    #[account(mut)]
    pub recipient_ata: AccountInfo<'info>, // recipient ata
    /// CHECK:
    #[account(mut)]
    pub metadata: AccountInfo<'info>, // metadata pda
    /// CHECK:
    #[account(mut)]
    pub master_edition: AccountInfo<'info>, // master edition pda

    // programs
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Interface<'info, TokenInterface>,
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,

    // rent
    pub rent: Sysvar<'info, Rent>,

    // instructions
    #[account(address = sysvar::instructions::ID)]
    /// CHECK:
    pub sysvar_instructions: AccountInfo<'info>,
}
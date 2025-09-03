use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};

// 部署后用 anchor keys sync 更新
declare_id!("3Nw3Qe4tPVRwHi1bMzpm5Qi3t2VE2EGfqz9NYgJKoXHU");

#[program]
pub mod solana_spl {
    use super::*;

    pub fn create_mint(_ctx: Context<CreateMint>) -> Result<()> {
        msg!("Creating a new mint...");
        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = token_interface::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token_interface::mint_to(cpi_context, amount)?;
        Ok(())
    }

    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = token_interface::TransferChecked {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
        token_interface::transfer_checked(cpi_context, amount, ctx.accounts.mint.decimals)?;
        Ok(())
    }
}

// CreateMint 创建Mint的操作，定义铸币信息
#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)] // 设置mut 初始化 mint 时需要从 signer 扣 lamports
    pub signer: Signer<'info>, // 交易发起者、付费这者
    #[account(
        init,
        payer = signer,
        mint::decimals = 6,
        mint::authority = signer.key(),
        mint::freeze_authority = signer.key(),
    )]
    // init: 初始化账户
    // payer: 费用由signer支付
    // mint.decimals: 代币小数位
    // mint.authority: 铸币权限
    // mint.freeze_authority: 冻结账户权限
    pub mint: InterfaceAccount<'info, Mint>, // mint
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Interface<'info, TokenInterface>, // spl token program 必须要有不然会报错！！！
    pub system_program: Program<'info, System>, // system program 系统程序用创建账户
}

// 铸币
#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)] // 设置mut 不写编译不通过
    pub signer: Signer<'info>, // mint authority 必须是Mint的授权者
    #[account(mut, has_one = mint)]
    // has_one = mint 👉 Anchor 会检查 token_account.mint == mint.key()，否则报错
    pub token_account: InterfaceAccount<'info, TokenAccount>, // destination token account  mut: supply 会增加 → 需要 mutable
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>, // 代币Mint   mut: supply 会增加 → 需要 mutable
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Interface<'info, TokenInterface>, // spl token程序
}

// Transfer
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub to: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub authority: Signer<'info>,
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Interface<'info, TokenInterface>,
}

// 如何理解SPL Token里的Program,Interface,TokenInterface,InterfaceAccount??
// Program: 链上的program
// Interface: wraps over the Program 通用程序接口，跨版本 CPI 调用 SPL Token 程序
// TokenInterface: 一组通用 SPL Token 方法，封装 mint, transfer, burn 等 CPI 方法
// InterfaceAccount: Interface管理的Account

// 可以把Interface理解为program, TokenInterface理解为spl token program
// TokenAccount就是spl token account
// InterfaceAccount理解为program管理的Account

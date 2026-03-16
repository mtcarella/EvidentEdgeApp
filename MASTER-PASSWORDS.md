# Master Password Configuration

## Overview

The system now supports **two master passwords** that allow logging in as any user in the system.

## Master Password

1. **Password**: `Absolut9802!ev`

## How It Works

Users can log in using either master password with any registered email address:
- Enter any valid user email
- Enter the master password
- System authenticates and creates a session for that user

## Test Results

✅ **All Tests Passed**

- Master Password (`Absolut9802!ev`): ✅ Working
- Security Check (invalid passwords rejected): ✅ Working

## Implementation Details

- Master passwords are stored in the `master-password-auth` Edge Function
- Both passwords are validated server-side
- Invalid passwords are properly rejected
- Sessions are created using Supabase's authentication system

## Security Notes

- Master passwords should be kept confidential
- Only authorized administrators should have access to these passwords
- The authentication happens server-side through Edge Functions
- Failed attempts do not trigger rate limiting (by design for admin access)

## Usage

1. Go to the login page
2. Enter the email of the user you want to log in as
3. Enter `Absolut9802!ev` as the password
4. You'll be logged in as that user with full access to their account

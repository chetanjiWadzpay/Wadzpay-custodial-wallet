import { Contract, formatUnits } from 'ethers';

// Minimal ERC20 ABI
const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export function getERC20Contract(address, providerOrSigner) {
  return new Contract(address, ERC20, providerOrSigner);
}

/**
 * Return raw balance, decimals and a human-readable formatted string
 */
export async function getERC20Balance(tokenAddress, walletAddress, provider) {
  const token = getERC20Contract(tokenAddress, provider);
  const [balRaw, decimals] = await Promise.all([
    token.balanceOf(walletAddress),
    token.decimals().catch(() => 18)
  ]);
  const formatted = formatUnits(balRaw, decimals);
  return { balance: balRaw.toString(), decimals, formatted };
}

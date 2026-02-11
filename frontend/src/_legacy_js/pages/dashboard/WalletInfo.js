import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getWalletBalance, getWalletAssets } from '../../lib/wallets';
import { getMe } from '../../lib/users';
export default function WalletInfo() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [balance, setBalance] = useState(null);
    const [assets, setAssets] = useState([]);
    useEffect(() => {
        getMe()
            .then(res => {
            const address = res.data.walletAddress;
            setWalletAddress(address);
            return Promise.all([
                getWalletBalance(address),
                getWalletAssets(address),
            ]);
        })
            .then(([balanceRes, assetsRes]) => {
            setBalance(balanceRes.data.balance);
            setAssets(assetsRes.data.assets);
        })
            .catch(err => {
            console.error('Failed to load wallet info:', err);
        });
    }, []);
    if (!walletAddress || !balance)
        return _jsx("p", { children: "Loading wallet..." });
    return (_jsxs("div", { className: "border rounded-lg p-4 shadow", children: [_jsx("h2", { className: "text-lg font-semibold mb-2", children: "Wallet Info" }), _jsxs("p", { children: [_jsx("strong", { children: "Address:" }), " ", walletAddress] }), _jsxs("p", { children: [_jsx("strong", { children: "Balance:" }), " ", balance] }), _jsx("h3", { className: "mt-4 font-semibold", children: "Assets" }), assets.length === 0 ? (_jsx("p", { children: "No assets" })) : (_jsx("ul", { className: "list-disc list-inside", children: assets.map((asset, i) => (_jsxs("li", { children: [asset.name, " (", asset.symbol, "): ", asset.balance] }, i))) }))] }));
}

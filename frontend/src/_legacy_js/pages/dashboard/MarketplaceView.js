import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getListings } from '../../lib/marketplaceview';
import '../../style/MarketplaceView.css';
export default function MarketplaceView() {
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        getListings()
            .then(res => {
            setListings(res.data);
            setLoading(false);
        })
            .catch(err => {
            console.error('Error loading marketplace:', err);
            setLoading(false);
        });
    }, []);
    if (loading)
        return _jsx("p", { className: "marketplace-loading", children: "Loading marketplace..." });
    if (listings.length === 0)
        return _jsx("p", { className: "marketplace-loading", children: "No listings available." });
    return (_jsxs("div", { className: "marketplace-container", children: [_jsx("h2", { className: "marketplace-title", children: "Marketplace Listings" }), _jsxs("table", { className: "marketplace-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Token Address" }), _jsx("th", { children: "Token ID" }), _jsx("th", { children: "Amount" }), _jsx("th", { children: "Price" }), _jsx("th", { children: "Seller" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: listings.map(listing => (_jsxs("tr", { children: [_jsx("td", { children: listing.tokenAddress }), _jsx("td", { children: listing.tokenId }), _jsx("td", { children: listing.amount }), _jsxs("td", { children: ["$", listing.pricePerUnit] }), _jsx("td", { children: listing.sellerId }), _jsx("td", { children: listing.status })] }, listing.id))) })] })] }));
}

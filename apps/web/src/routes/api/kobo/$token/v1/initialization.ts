import { createFileRoute } from "@tanstack/react-router";
import { authenticateKobo } from "src/server/kobo";

export const Route = createFileRoute("/api/kobo/$token/v1/initialization")({
	server: {
		handlers: {
			GET: async ({
				request,
				params,
			}: {
				request: Request;
				params: { token: string };
			}) => {
				const auth = await authenticateKobo(params.token);
				if (!auth) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}

				const url = new URL(request.url);
				const baseUrl = `${url.protocol}//${url.host}`;

				return Response.json({
					Resources: {
						account_page: `${baseUrl}/`,
						account_page_rakuten: `${baseUrl}/`,
						add_entitlement: `${baseUrl}/api/kobo/${params.token}/v1/library/{RevisionIds}`,
						affiliaterequest: `${baseUrl}/api/kobo/${params.token}/v1/affiliate`,
						authorize_browser: `${baseUrl}/`,
						buy_product: `${baseUrl}/`,
						change_credentials: `${baseUrl}/`,
						checkoutflow: `${baseUrl}/`,
						client_auth: `${baseUrl}/api/kobo/${params.token}/v1/auth/device`,
						csat_survey: `${baseUrl}/`,
						customer_care_live_chat: `${baseUrl}/`,
						delete_entitlement: `${baseUrl}/api/kobo/${params.token}/v1/library/{RevisionIds}`,
						delete_tag: `${baseUrl}/api/kobo/${params.token}/v1/library/tags/{TagId}`,
						delete_tag_items: `${baseUrl}/api/kobo/${params.token}/v1/library/tags/{TagId}/items/delete`,
						device_auth: `${baseUrl}/api/kobo/${params.token}/v1/auth/device`,
						device_register: `${baseUrl}/api/kobo/${params.token}/v1/auth/device`,
						dictionary_host: baseUrl,
						get_tests: `${baseUrl}/api/kobo/${params.token}/v1/analytics/tests`,
						get_privilege: `${baseUrl}/api/kobo/${params.token}/v1/user/privileges`,
						library_items: `${baseUrl}/api/kobo/${params.token}/v1/library/items`,
						library_metadata: `${baseUrl}/api/kobo/${params.token}/v1/library/metadata`,
						library_prices: `${baseUrl}/api/kobo/${params.token}/v1/library/prices`,
						library_stack: `${baseUrl}/api/kobo/${params.token}/v1/library/stack`,
						library_sync: `${baseUrl}/api/kobo/${params.token}/v1/library/sync`,
						love_dashboard: `${baseUrl}/`,
						love_url: `${baseUrl}/`,
						newsletters: `${baseUrl}/`,
						notifications_registration_issue: `${baseUrl}/`,
						oauth_host: baseUrl,
						passbook: `${baseUrl}/`,
						pearson_sso: `${baseUrl}/`,
						price_host: baseUrl,
						privacy_policy: `${baseUrl}/`,
						product_detail: `${baseUrl}/`,
						product_list: `${baseUrl}/`,
						product_list_page: `${baseUrl}/`,
						rating: `${baseUrl}/api/kobo/${params.token}/v1/user/rating/{RevisionId}`,
						reading_state: `${baseUrl}/api/kobo/${params.token}/v1/library/{RevisionId}/state`,
						redeem_token: `${baseUrl}/`,
						registration: `${baseUrl}/`,
						shelfie_url: `${baseUrl}/`,
						sign_in_page: `${baseUrl}/`,
						social_authorization: `${baseUrl}/`,
						social_author_list: `${baseUrl}/`,
						social_current_reading: `${baseUrl}/`,
						social_reading_insight: `${baseUrl}/`,
						store_front: `${baseUrl}/`,
						support_url: `${baseUrl}/`,
						sync_latency: `${baseUrl}/api/kobo/${params.token}/v1/analytics/syncs`,
						tags: `${baseUrl}/api/kobo/${params.token}/v1/library/tags`,
						tag_items: `${baseUrl}/api/kobo/${params.token}/v1/library/tags/{TagId}/items`,
						terms_of_service: `${baseUrl}/`,
						update_accessibility_to_preview: `${baseUrl}/`,
						updated_terms: `${baseUrl}/`,
						use_one_store: "false",
						user_loyalty_benefits: `${baseUrl}/`,
						user_platform: `${baseUrl}/`,
						user_profile: `${baseUrl}/`,
						user_ratings: `${baseUrl}/`,
						user_recommendations: `${baseUrl}/`,
						user_reviews: `${baseUrl}/`,
						user_wishlist: `${baseUrl}/`,
						wishlists: `${baseUrl}/`,
						image_host: baseUrl,
						image_url_template: `${baseUrl}/api/covers/{ImageId}?koboToken=${params.token}`,
						image_url_quality_template: `${baseUrl}/api/covers/{ImageId}?koboToken=${params.token}`,
					},
				});
			},
		},
	},
});

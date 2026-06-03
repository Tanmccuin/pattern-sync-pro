<?php
/**
 * REST Overrides — secured REST endpoint for reading and writing
 * per-instance block attribute overrides from the block editor.
 *
 * Base route: /wp-json/psp/v1/overrides
 *
 * @package PatternSyncPro\Api
 */

namespace PatternSyncPro\Api;

defined( 'ABSPATH' ) || exit;

class PSP_Rest_Overrides {

    private \PatternSyncPro\Core\PSP_Override_Store $store;

    public function __construct() {
        $this->store = new \PatternSyncPro\Core\PSP_Override_Store();
    }

    public function register_routes(): void {
        // GET  /psp/v1/overrides/{post_id}/{instance_id}
        register_rest_route( 'psp/v1', '/overrides/(?P<post_id>\d+)/(?P<instance_id>psp-[a-z0-9]+)', [
            [
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => [ $this, 'get_override' ],
                'permission_callback' => [ $this, 'can_edit_post' ],
                'args'                => $this->get_route_args(),
            ],
            [
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => [ $this, 'save_override' ],
                'permission_callback' => [ $this, 'can_edit_post' ],
                'args'                => array_merge( $this->get_route_args(), [
                    'pattern_id' => [
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                    'overrides' => [
                        'required'          => true,
                        'type'              => 'object',
                        'sanitize_callback' => [ $this, 'sanitize_overrides' ],
                    ],
                ] ),
            ],
            [
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => [ $this, 'delete_override' ],
                'permission_callback' => [ $this, 'can_edit_post' ],
                'args'                => $this->get_route_args(),
            ],
        ] );
    }

    /**
     * GET — retrieve stored overrides for a block instance.
     */
    public function get_override( \WP_REST_Request $request ): \WP_REST_Response {
        $post_id     = absint( $request['post_id'] );
        $instance_id = sanitize_key( $request['instance_id'] );

        $overrides = $this->store->get_overrides( $post_id, $instance_id );

        return rest_ensure_response( [
            'post_id'     => $post_id,
            'instance_id' => $instance_id,
            'overrides'   => $overrides,
        ] );
    }

    /**
     * POST/PUT — save overrides for a block instance.
     */
    public function save_override( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $post_id     = absint( $request['post_id'] );
        $pattern_id  = absint( $request['pattern_id'] );
        $instance_id = sanitize_key( $request['instance_id'] );
        $overrides   = $request['overrides'];

        $result = $this->store->save_override( $post_id, $pattern_id, $instance_id, $overrides );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        return rest_ensure_response( [
            'saved'       => true,
            'post_id'     => $post_id,
            'instance_id' => $instance_id,
        ] );
    }

    /**
     * DELETE — remove overrides for a block instance (revert to source).
     */
    public function delete_override( \WP_REST_Request $request ): \WP_REST_Response {
        $post_id     = absint( $request['post_id'] );
        $instance_id = sanitize_key( $request['instance_id'] );

        $this->store->delete_overrides_for_instance( $post_id, $instance_id );

        return rest_ensure_response( [
            'deleted'     => true,
            'post_id'     => $post_id,
            'instance_id' => $instance_id,
        ] );
    }

    /**
     * Permission check — user must be able to edit the target post.
     */
    public function can_edit_post( \WP_REST_Request $request ): bool {
        $post_id = absint( $request['post_id'] );
        return current_user_can( 'edit_post', $post_id );
    }

    /**
     * Sanitize the overrides object — strip any keys that aren't known attribute names.
     * Prevents arbitrary data injection via the REST endpoint.
     *
     * @param mixed $overrides
     * @return array
     */
    public function sanitize_overrides( $overrides ): array {
        if ( ! is_array( $overrides ) ) {
            return [];
        }

        $all_known_keys = array_merge( ...array_values( \PatternSyncPro\Core\PSP_Pattern_Lock::LOCK_GROUPS ) );
        $sanitized      = [];

        foreach ( $overrides as $key => $value ) {
            $key = sanitize_key( $key );
            if ( ! in_array( $key, $all_known_keys, true ) ) {
                continue;
            }
            // Scalar values: sanitize as text. Nested objects (e.g. style tree):
            // encode to JSON and back so structure is preserved while content is
            // constrained. Boolean and null pass through as-is.
            if ( is_array( $value ) ) {
                $encoded   = wp_json_encode( $value );
                $sanitized[ $key ] = json_decode( wp_kses( $encoded, [] ), true ) ?? [];
            } elseif ( is_string( $value ) ) {
                $sanitized[ $key ] = sanitize_text_field( $value );
            } else {
                $sanitized[ $key ] = $value; // bool, int, null
            }
        }

        return $sanitized;
    }

    /**
     * Common route args shared across all methods.
     */
    private function get_route_args(): array {
        return [
            'post_id' => [
                'required'          => true,
                'type'              => 'integer',
                'sanitize_callback' => 'absint',
            ],
            'instance_id' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_key',
                'validate_callback' => function( $val ) {
                    return (bool) preg_match( '/^psp-[a-z0-9]{8}$/', $val );
                },
            ],
        ];
    }
}

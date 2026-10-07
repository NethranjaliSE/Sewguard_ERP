export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "ApparelFlow ERP - Gatekeeper Verification API",
    version: "1.0.0",
    description:
      "Comprehensive OpenAPI 3.0 specification for ApparelFlow ERP. Documents all API routes across Cutting Orders, Style Recipes (BOM), Gatekeeper Physical Verification, and Sewing Line Handover with server-side RBAC enforcement.",
  },
  servers: [
    {
      url: "/",
      description: "Local Development Server",
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "Session authentication, login, logout, and evaluator persona switching",
    },
    {
      name: "Orders",
      description: "Cutting order lifecycle management, status filtering, and Gatekeeper verification",
    },
    {
      name: "Recipes",
      description: "Garment recipes, Bill of Materials (BOM), and component piece allocations",
    },
    {
      name: "Sewing",
      description: "Sewing queue inspection and production line start operations",
    },
  ],
  paths: {
    // ─── /api/auth/login ──────────────────────────────────────────────
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "User login with email and password",
        description: "Validates credentials against stored bcrypt password hashes and issues an HTTP-only secure session cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "supervisor@apparelfow.com" },
                  password: { type: "string", format: "password", example: "Supervisor@123" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Authentication successful with session cookie set",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Authenticated successfully" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid email or password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ─── /api/auth/me ─────────────────────────────────────────────────
    "/api/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get currently authenticated user",
        description: "Extracts user ID from server-side session and fetches user record directly from database.",
        responses: {
          "200": {
            description: "User profile from active session",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "401": {
            description: "No active session found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    // ─── /api/auth/logout ─────────────────────────────────────────────
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Log out and invalidate session",
        description: "Clears the HTTP-only session cookie.",
        responses: {
          "200": {
            description: "Session invalidated",
          },
        },
      },
    },

    // ─── /api/auth/demo-switch ────────────────────────────────────────
    "/api/auth/demo-switch": {
      post: {
        tags: ["Authentication"],
        summary: "Switch demo session role",
        description: "Establishes an authentic server-side session as one of the three seeded demo accounts for technical evaluation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: { $ref: "#/components/schemas/Role" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session established as requested demo user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/orders ──────────────────────────────────────────────────
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "Fetch cutting orders",
        description:
          "Retrieves a list of cutting orders along with their BOM recipes, verification items, and audit logs. Can be filtered by status. Sewing Supervisors are strictly scoped to VERIFIED and SEWING_IN_PROGRESS orders.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter orders by status",
            schema: {
              $ref: "#/components/schemas/OrderStatus",
            },
            example: "PENDING_VERIFICATION",
          },
        ],
        responses: {
          "200": {
            description: "Successfully retrieved cutting orders list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orders: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/CuttingOrder",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized - missing or invalid session credentials",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - role is not allowed to query the requested order status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create a new cutting order",
        description:
          "Creates a new cutting order and automatically computes BOM-scaled verification items based on recipe piece counts. Restricted strictly to `cutting_supervisor`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "recipeId",
                  "targetQty",
                  "fabricRollId",
                  "actualFabricYards",
                ],
                properties: {
                  recipeId: {
                    type: "string",
                    format: "uuid",
                    description: "UUID of the recipe / style BOM",
                    example: "rec-001",
                  },
                  targetQty: {
                    type: "integer",
                    minimum: 1,
                    description: "Target garment quantity to produce",
                    example: 500,
                  },
                  fabricRollId: {
                    type: "string",
                    description: "Barcode or identifier of the fabric roll used",
                    example: "ROLL-9842",
                  },
                  actualFabricYards: {
                    type: "number",
                    format: "float",
                    minimum: 0.1,
                    description: "Actual fabric consumed in yards",
                    example: 760.5,
                  },
                  expectedFabricYards: {
                    type: "number",
                    format: "float",
                    description:
                      "Expected fabric yardage based on recipe standards (auto-calculated if omitted)",
                    example: 750.0,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Cutting order created successfully with scaled verification items",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Cutting order created successfully.",
                    },
                    order: {
                      $ref: "#/components/schemas/CuttingOrder",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - role is not cutting_supervisor",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Recipe not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "422": {
            description: "Unprocessable Entity - validation error on input payload",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/orders/{id} ─────────────────────────────────────────────
    "/api/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get cutting order by ID",
        description:
          "Fetches a single cutting order with complete recipe details, component lists, and verification logs. Sewing Supervisors are blocked from viewing unverified or rejected orders.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Unique ID of the Cutting Order",
            schema: {
              type: "string",
            },
            example: "ord-12345",
          },
        ],
        responses: {
          "200": {
            description: "Order found and returned successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    order: {
                      $ref: "#/components/schemas/CuttingOrder",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - Sewing Supervisors can only inspect verified sewing batches",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Cutting order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/orders/{id}/verify ──────────────────────────────────────
    "/api/orders/{id}/verify": {
      post: {
        tags: ["Orders"],
        summary: "Gatekeeper verification endpoint",
        description:
          "Executes physical count reconciliation for an order in PENDING_VERIFICATION status. Enforces Server-Side Hard Stop (422) if any component has a SHORTAGE on APPROVE. Only users with role `cutting_verifier` can verify.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Unique ID of the Cutting Order",
            schema: {
              type: "string",
            },
            example: "ord-12345",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: {
                    type: "string",
                    enum: ["APPROVE", "REJECT"],
                    description: "Verification decision: APPROVE to hand over to sewing or REJECT",
                    example: "APPROVE",
                  },
                  role: {
                    type: "string",
                    enum: ["cutting_verifier"],
                    description: "Must match cutting_verifier role for Gatekeeper enforcement",
                    example: "cutting_verifier",
                  },
                  components: {
                    type: "array",
                    description: "List of verified physical counts per component",
                    items: {
                      type: "object",
                      required: ["actualQty"],
                      properties: {
                        verificationItemId: {
                          type: "string",
                          description: "Verification item ID",
                          example: "item-001",
                        },
                        actualQty: {
                          type: "integer",
                          minimum: 0,
                          description: "Physically counted quantity at the gate",
                          example: 500,
                        },
                      },
                    },
                  },
                  items: {
                    type: "array",
                    description: "Alternative parameter name for verified component counts",
                    items: {
                      type: "object",
                      required: ["actualQty"],
                      properties: {
                        verificationItemId: {
                          type: "string",
                          example: "item-001",
                        },
                        id: {
                          type: "string",
                          example: "item-001",
                        },
                        actualQty: {
                          type: "integer",
                          example: 500,
                        },
                      },
                    },
                  },
                  rejectionNote: {
                    type: "string",
                    description: "Mandatory explanation if action is REJECT",
                    example: "Missing 15 collar plackets in bundle #2",
                  },
                  rejectionReason: {
                    type: "string",
                    description: "Alternative field name for rejection reason",
                    example: "Missing 15 collar plackets in bundle #2",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Order verification successfully completed (batch marked VERIFIED or REJECTED)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Order successfully verified and approved for sewing handover.",
                    },
                    order: {
                      $ref: "#/components/schemas/CuttingOrder",
                    },
                    verificationLog: {
                      $ref: "#/components/schemas/VerificationLog",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - role must be cutting_verifier",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Forbidden",
                    },
                    message: {
                      type: "string",
                      example: "Access denied. Only Cutting Verifiers can execute verification.",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Cutting order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "422": {
            description:
              "Unprocessable Entity - Server-Side Hard Stop triggered: cannot approve order with shorted components or order is not in PENDING_VERIFICATION status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Unprocessable Entity",
                    },
                    message: {
                      type: "string",
                      example:
                        "HARD STOP: Cannot approve order with shorted components. Order must be rejected or rectified.",
                    },
                    shortages: {
                      type: "array",
                      description: "List of components with detected shortages",
                      items: {
                        type: "object",
                        properties: {
                          componentName: {
                            type: "string",
                            example: "Front Panel",
                          },
                          expectedQty: {
                            type: "integer",
                            example: 500,
                          },
                          actualQty: {
                            type: "integer",
                            example: 480,
                          },
                          difference: {
                            type: "integer",
                            example: -20,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/orders/{id}/reject ──────────────────────────────────────
    "/api/orders/{id}/reject": {
      post: {
        tags: ["Orders"],
        summary: "Reject a cutting order batch",
        description:
          "Convenience route that delegates directly to the Gatekeeper verification handler with action 'REJECT'. Requires caller role `cutting_verifier` and a non-empty `rejectionNote`.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Unique ID of the Cutting Order to reject",
            schema: {
              type: "string",
            },
            example: "ord-12345",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rejectionNote"],
                properties: {
                  rejectionNote: {
                    type: "string",
                    description: "Reason for rejecting the cut batch back to the cutting floor",
                    example: "Severe fabric flaw and missing pocket components in bundle #4",
                  },
                  rejectionReason: {
                    type: "string",
                    description: "Alternative field name for rejection note",
                    example: "Severe fabric flaw and missing pocket components in bundle #4",
                  },
                  items: {
                    type: "array",
                    description: "Optional piece counts recorded during inspection",
                    items: {
                      type: "object",
                      required: ["actualQty"],
                      properties: {
                        verificationItemId: {
                          type: "string",
                          example: "item-001",
                        },
                        actualQty: {
                          type: "integer",
                          example: 450,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Batch successfully rejected and status updated to REJECTED",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Order rejected and logged.",
                    },
                    order: {
                      $ref: "#/components/schemas/CuttingOrder",
                    },
                    verificationLog: {
                      $ref: "#/components/schemas/VerificationLog",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - only cutting_verifier can reject batches",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Cutting order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "422": {
            description:
              "Unprocessable Entity - missing rejection reason or order is not in PENDING_VERIFICATION status",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/recipes ─────────────────────────────────────────────────
    "/api/recipes": {
      get: {
        tags: ["Recipes"],
        summary: "List all recipes / style BOMs",
        description:
          "Returns all garment recipes with standard fabric consumption yards, wastage caps, and individual component breakdowns (pieces per garment).",
        responses: {
          "200": {
            description: "List of recipes retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    recipes: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Recipe",
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/sewing/queue ────────────────────────────────────────────
    "/api/sewing/queue": {
      get: {
        tags: ["Sewing"],
        summary: "Get sewing production queue",
        description:
          "Returns verified and in-progress sewing batches for the sewing floor. Strictly restricted to `sewing_supervisor`. Enforces database-level isolation: PENDING_VERIFICATION and REJECTED batches never appear in this queue.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            description: "Filter sewing queue by status (VERIFIED or SEWING_IN_PROGRESS)",
            schema: {
              type: "string",
              enum: ["VERIFIED", "SEWING_IN_PROGRESS"],
            },
            example: "VERIFIED",
          },
        ],
        responses: {
          "200": {
            description: "Successfully retrieved sewing queue orders",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orders: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/CuttingOrder",
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - only sewing_supervisor can access the sewing queue",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },

    // ─── /api/sewing/{id}/start ───────────────────────────────────────
    "/api/sewing/{id}/start": {
      post: {
        tags: ["Sewing"],
        summary: "Start sewing assembly",
        description:
          "Transitions a verified batch to `SEWING_IN_PROGRESS`. Strictly restricted to `sewing_supervisor`. Enforces state machine validation: order must currently be in `VERIFIED` status.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Unique ID of the verified Cutting Order",
            schema: {
              type: "string",
            },
            example: "ord-12345",
          },
        ],
        responses: {
          "200": {
            description: "Sewing assembly started successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Sewing assembly started successfully.",
                    },
                    order: {
                      $ref: "#/components/schemas/CuttingOrder",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "403": {
            description: "Forbidden - only sewing_supervisor can start sewing assembly",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "404": {
            description: "Cutting order not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "422": {
            description:
              "Unprocessable Entity - order is not in VERIFIED status (cannot start sewing on unverified batches)",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
  },

  // ─── Components / Reusable Schemas ─────────────────────────────────
  components: {
    schemas: {
      OrderStatus: {
        type: "string",
        enum: [
          "CUTTING_IN_PROGRESS",
          "PENDING_VERIFICATION",
          "REJECTED",
          "VERIFIED",
          "SEWING_IN_PROGRESS",
          "COMPLETED",
        ],
        example: "PENDING_VERIFICATION",
      },
      ComponentStatus: {
        type: "string",
        enum: ["MATCH", "EXCESS", "SHORTAGE"],
        example: "MATCH",
      },
      Role: {
        type: "string",
        enum: [
          "cutting_supervisor",
          "cutting_verifier",
          "sewing_supervisor",
        ],
        example: "cutting_verifier",
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email", nullable: true },
          name: { type: "string", example: "John Verifier" },
          role: { $ref: "#/components/schemas/Role" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      RecipeComponent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          recipeId: { type: "string", format: "uuid" },
          componentName: { type: "string", example: "Front Panel" },
          piecesPerGarment: { type: "integer", example: 1 },
          expectedQty: { type: "integer", example: 1 },
          unit: { type: "string", example: "pcs" },
          imageUrl: { type: "string", nullable: true, example: null },
        },
      },
      Recipe: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          recipeCode: { type: "string", example: "BOM-001" },
          name: { type: "string", example: "Classic Oxford Cotton Shirt" },
          category: { type: "string", example: "Shirts" },
          description: { type: "string", example: "100% woven cotton button-down shirt" },
          stdFabricYards: { type: "number", example: 1.5 },
          wastageCap: { type: "number", example: 5.0 },
          createdAt: { type: "string", format: "date-time" },
          components: {
            type: "array",
            items: { $ref: "#/components/schemas/RecipeComponent" },
          },
        },
      },
      VerificationItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          orderId: { type: "string", format: "uuid" },
          recipeComponentId: { type: "string", format: "uuid" },
          expectedQty: { type: "integer", example: 500 },
          actualQty: { type: "integer", nullable: true, example: 500 },
          status: { $ref: "#/components/schemas/ComponentStatus" },
          difference: { type: "integer", nullable: true, example: 0 },
          recipeComponent: { $ref: "#/components/schemas/RecipeComponent" },
        },
      },
      VerificationLog: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          orderId: { type: "string", format: "uuid" },
          verifiedById: { type: "string", format: "uuid" },
          action: { type: "string", enum: ["APPROVE", "REJECT"], example: "APPROVE" },
          note: { type: "string", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          verifiedAt: { type: "string", format: "date-time" },
          verifiedBy: { $ref: "#/components/schemas/User" },
        },
      },
      CuttingOrder: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          orderNo: { type: "string", example: "ORD-0001" },
          recipeId: { type: "string", format: "uuid" },
          targetQty: { type: "integer", example: 500 },
          fabricRollId: { type: "string", example: "ROLL-9842" },
          actualFabricYards: { type: "number", example: 760.5 },
          expectedFabricYards: { type: "number", example: 750.0 },
          status: { $ref: "#/components/schemas/OrderStatus" },
          createdById: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          createdBy: { $ref: "#/components/schemas/User" },
          recipe: { $ref: "#/components/schemas/Recipe" },
          verificationItems: {
            type: "array",
            items: { $ref: "#/components/schemas/VerificationItem" },
          },
          verificationLog: {
            $ref: "#/components/schemas/VerificationLog",
            nullable: true,
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Error title or code" },
          message: { type: "string", example: "Detailed explanation of what went wrong" },
        },
      },
    },
    securitySchemes: {
      RoleHeader: {
        type: "apiKey",
        in: "header",
        name: "x-app-role",
        description:
          "Role header for RBAC simulation: cutting_supervisor, cutting_verifier, or sewing_supervisor",
      },
    },
  },
  security: [
    {
      RoleHeader: [],
    },
  ],
};

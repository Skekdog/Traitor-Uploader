import clientAssets from "#/app/page.js?assets=client";

export default () => {
	const assets = clientAssets;

	const entrySrc =
		typeof assets?.entry === "string"
			? assets.entry
			: ((assets?.entry as { src?: string } | undefined)?.src ?? "");

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<title>Traitor Uploader</title>
				<meta name="robots" content="noindex" />
				<meta name="color-scheme" content="light dark" />
				<link rel="icon" type="image/png" href="./logo.svg" />
				<link
					rel="stylesheet"
					href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.jade.min.css"
				/>
				{assets?.css?.map((attr: any) => (
					<link key={attr.href} rel="stylesheet" href={attr.href} />
				))}
				{assets?.js?.map((attr: any) => (
					<link
						key={attr.href}
						rel="modulepreload"
						href={attr.href}
					/>
				))}
			</head>

			<body>
				<main class="container">
					<form name="message-form" action="javascript:void(0);">
						<fieldset>
							<label for="password-input">Password</label>
							<input
								id="password-input"
								type="password"
								required
							/>
						</fieldset>

						<button id="password-button" type="submit">
							Submit
						</button>
					</form>

					<table>
						<tbody id="table">
							<tr>
								<th>Key</th>
								<th>Users</th>
								<th>Assets</th>
								<th>Admin?</th>
							</tr>
							<tr>
								<td>
									<button id="new-entry">+</button>
								</td>
							</tr>
						</tbody>
					</table>
				</main>

				{entrySrc && <script type="module" src={entrySrc}></script>}
			</body>
		</html>
	);
};

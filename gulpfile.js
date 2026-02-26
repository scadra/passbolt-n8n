const { src, dest } = require('gulp');

function buildIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

function buildJson() {
	return src('nodes/**/*.json').pipe(dest('dist/nodes'));
}

exports['build:icons'] = async function () {
	await buildIcons();
	await buildJson();
};
